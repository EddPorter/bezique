import { findCard, hasCarteBlanche, removeCard } from './cards.js';
import { findAllDeclarableMelds } from './melds.js';
import { endgameLegalFollowCards, resolveTrick } from './trick.js';
import type { GameState, Move, PlayerId, Player } from './types.js';

const other = (id: PlayerId): PlayerId => (id === 0 ? 1 : 0);

function getPlayer(state: GameState, id: PlayerId): Player {
  return state.players[id];
}

function withPlayer(state: GameState, id: PlayerId, player: Player): GameState {
  const players: [Player, Player] =
    id === 0 ? [player, state.players[1]] : [state.players[0], player];
  return { ...state, players };
}

export function getLegalMoves(state: GameState, playerId: PlayerId): Move[] {
  if (playerId !== state.turn) return [];
  if (state.phase === 'scoring' || state.phase === 'complete' || state.phase === 'dealing') return [];

  const player = getPlayer(state, playerId);

  if (state.stage === 'awaitingLead') {
    return player.hand.map((card) => ({ type: 'playCard', playerId, cardId: card.id }));
  }

  if (state.stage === 'awaitingFollow') {
    const leadCard = state.currentTrick.leadCard;
    if (!leadCard) return [];
    const legalCards =
      state.phase === 'endgame'
        ? endgameLegalFollowCards(player.hand, leadCard, state.trumpSuit)
        : player.hand;
    return legalCards.map((card) => ({ type: 'playCard', playerId, cardId: card.id }));
  }

  if (state.stage === 'awaitingMeldDecision') {
    const options = findAllDeclarableMelds(
      state.ruleset,
      player.hand,
      player.melds,
      state.trumpSuit,
      state.cardMeldClassUsage,
    );
    const declareMoves: Move[] = options.map((o) => ({
      type: 'declareMeld',
      playerId,
      meldKind: o.kind,
      cardIds: o.cardIds,
    }));
    return [...declareMoves, { type: 'pass', playerId }];
  }

  return [];
}

function isLegal(state: GameState, move: Move): boolean {
  const legalMoves = getLegalMoves(state, move.playerId);
  if (move.type === 'declareMeld') {
    return legalMoves.some(
      (m) =>
        m.type === 'declareMeld' &&
        m.meldKind === move.meldKind &&
        m.cardIds.length === move.cardIds.length &&
        m.cardIds.every((id) => move.cardIds.includes(id)),
    );
  }
  return legalMoves.some((m) => JSON.stringify(m) === JSON.stringify(move));
}

/** Draws for winner then loser (per rules spec §2.5), awarding carte blanche re-declarations as it goes. */
function drawStockForBothPlayers(state: GameState, winnerId: PlayerId): GameState {
  let next = state;
  for (const id of [winnerId, other(winnerId)] as PlayerId[]) {
    if (next.deck.length === 0) continue;
    const [drawnCard, ...remaining] = next.deck;
    const player = getPlayer(next, id);
    const newHand = [...player.hand, drawnCard!];
    const carteBlanchePoints = hasCarteBlanche(newHand) ? next.ruleset.carteBlanchePoints : 0;
    const updatedPlayer: Player = {
      ...player,
      hand: newHand,
      score: player.score + carteBlanchePoints,
      carteBlanchePoints: player.carteBlanchePoints + carteBlanchePoints,
    };
    next = { ...withPlayer(next, id, updatedPlayer), deck: remaining };
  }
  return next;
}

function bothHandsEmpty(state: GameState): boolean {
  return state.players[0].hand.length === 0 && state.players[1].hand.length === 0;
}

function applyPlayCard(state: GameState, playerId: PlayerId, cardId: string): GameState {
  const player = getPlayer(state, playerId);
  const card = findCard(player.hand, cardId)!;
  const newHand = removeCard(player.hand, cardId);
  let next = withPlayer(state, playerId, { ...player, hand: newHand });

  if (state.stage === 'awaitingLead') {
    return {
      ...next,
      currentTrick: { leaderId: playerId, leadCard: card },
      turn: other(playerId),
      stage: 'awaitingFollow',
    };
  }

  // awaitingFollow: resolve the trick
  const leadCard = state.currentTrick.leadCard!;
  const leaderId = state.currentTrick.leaderId;
  const winnerId = resolveTrick(leadCard, leaderId, card, playerId, state.trumpSuit);
  const tricksWon = { ...next.tricksWon, [winnerId]: [...next.tricksWon[winnerId], leadCard, card] };
  next = { ...next, tricksWon, lastTrickWinnerId: winnerId };

  if (state.phase === 'main') {
    return { ...next, turn: winnerId, stage: 'awaitingMeldDecision' };
  }

  // endgame: no melds, straight into the next lead (or scoring if hands are now empty)
  next = { ...next, turn: winnerId, stage: 'awaitingLead', currentTrick: { leaderId: winnerId, leadCard: null } };
  if (bothHandsEmpty(next)) {
    const winner = getPlayer(next, winnerId);
    next = withPlayer(next, winnerId, { ...winner, score: winner.score + next.ruleset.lastTrickBonus });
    next = { ...next, phase: 'scoring' };
  }
  return next;
}

function afterMeldWindow(state: GameState, winnerId: PlayerId): GameState {
  let next = drawStockForBothPlayers(state, winnerId);
  const phase = next.deck.length === 0 ? 'endgame' : 'main';
  return {
    ...next,
    phase,
    stage: 'awaitingLead',
    turn: winnerId,
    currentTrick: { leaderId: winnerId, leadCard: null },
  };
}

function applyDeclareMeld(state: GameState, playerId: PlayerId, move: Extract<Move, { type: 'declareMeld' }>): GameState {
  const options = findAllDeclarableMelds(
    state.ruleset,
    getPlayer(state, playerId).hand,
    getPlayer(state, playerId).melds,
    state.trumpSuit,
    state.cardMeldClassUsage,
  );
  const chosen = options.find(
    (o) =>
      o.kind === move.meldKind &&
      o.cardIds.length === move.cardIds.length &&
      o.cardIds.every((id) => move.cardIds.includes(id)),
  );
  if (!chosen) throw new Error('Illegal meld declaration');

  // A marriage/sequence that establishes trumps (first of the hand) scores at the trump rate itself.
  const establishesTrump = state.trumpSuit === null && (chosen.kind === 'marriage' || chosen.kind === 'sequence');
  const def = state.ruleset.meldTable[chosen.kind];
  const points = establishesTrump && def.class === 'sequence' ? def.trumpPoints : chosen.points;

  const moveIndex = state.history.length;
  const player = getPlayer(state, playerId);
  const newMeld = {
    id: `${chosen.kind}-${moveIndex}`,
    kind: chosen.kind,
    class: chosen.class,
    suit: chosen.suit,
    cardIds: chosen.cardIds,
    points,
    declaredAtMoveIndex: moveIndex,
    lastScoredAtMoveIndex: moveIndex,
  };

  let next = withPlayer(state, playerId, {
    ...player,
    melds: [...player.melds, newMeld],
    score: player.score + points,
  });

  if (!chosen.isReplacement) {
    const cardMeldClassUsage = { ...next.cardMeldClassUsage };
    for (const cardId of chosen.cardIds) {
      cardMeldClassUsage[cardId] = [...(cardMeldClassUsage[cardId] ?? []), chosen.class];
    }
    next = { ...next, cardMeldClassUsage };
  }

  if (next.trumpSuit === null && (chosen.kind === 'marriage' || chosen.kind === 'sequence')) {
    next = { ...next, trumpSuit: chosen.suit! };
  }

  return afterMeldWindow(next, playerId);
}

export function applyMove(state: GameState, move: Move): GameState {
  if (!isLegal(state, move)) {
    throw new Error(`Illegal move: ${JSON.stringify(move)}`);
  }
  const history = [...state.history, move];
  const base = { ...state, history };

  switch (move.type) {
    case 'playCard':
      return applyPlayCard(base, move.playerId, move.cardId);
    case 'declareMeld':
      return applyDeclareMeld(base, move.playerId, move);
    case 'pass':
      return afterMeldWindow(base, move.playerId);
  }
}
