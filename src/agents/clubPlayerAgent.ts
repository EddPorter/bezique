import { isCourtCard, rankValue } from '../engine/cards.js';
import { findAllDeclarableMelds } from '../engine/melds.js';
import type { Card, GameState, Move, PlayerId, Suit } from '../engine/types.js';
import type { Agent } from './types.js';

function isBrisque(card: Card): boolean {
  return card.rank === 'A' || card.rank === '10';
}

/** Lower = safer to discard: non-court, non-brisque, low-rank cards go first. */
function discardValue(card: Card): number {
  let value = rankValue(card.rank);
  if (isCourtCard(card.rank)) value += 20;
  if (isBrisque(card)) value += 15;
  return value;
}

function findCardById(hand: Card[], id: string): Card {
  const card = hand.find((c) => c.id === id);
  if (!card) throw new Error(`Card ${id} not in hand`);
  return card;
}

function wouldWin(followCard: Card, leadCard: Card, trumpSuit: Suit | null): boolean {
  if (followCard.suit === leadCard.suit) return rankValue(followCard.rank) > rankValue(leadCard.rank);
  return trumpSuit !== null && followCard.suit === trumpSuit;
}

function leastValuable(playMoves: Extract<Move, { type: 'playCard' }>[], hand: Card[]): Move {
  return [...playMoves].sort(
    (a, b) => discardValue(findCardById(hand, a.cardId)) - discardValue(findCardById(hand, b.cardId)),
  )[0]!;
}

/**
 * A simple "club player" heuristic (architecture plan §5): declares the
 * highest-value meld on offer, avoids giving away brisques/court cards when
 * leading or discarding, and wins a trick cheaply when the lead card is worth
 * capturing. This is deliberately not the shared weighted-evaluation function
 * with a structured breakdown that step 6 builds for the tutor — that's a
 * later step; this just needs to be a sensible opponent for the game loop.
 */
export function chooseClubPlayerMove(state: GameState, playerId: PlayerId, legalMoves: Move[]): Move {
  const player = state.players[playerId];
  const hand = player.hand;

  if (legalMoves.some((m) => m.type === 'declareMeld')) {
    const meldOptions = findAllDeclarableMelds(
      state.ruleset,
      hand,
      player.melds,
      state.trumpSuit,
      state.cardMeldClassUsage,
    );
    const best = [...meldOptions].sort((a, b) => b.points - a.points)[0];
    if (best) {
      return { type: 'declareMeld', playerId, meldKind: best.kind, cardIds: best.cardIds };
    }
  }

  const passMove = legalMoves.find((m) => m.type === 'pass');
  if (passMove) return passMove;

  const playMoves = legalMoves.filter((m): m is Extract<Move, { type: 'playCard' }> => m.type === 'playCard');

  if (state.stage === 'awaitingLead') {
    return leastValuable(playMoves, hand);
  }

  const leadCard = state.currentTrick.leadCard;
  if (state.phase === 'main' && leadCard) {
    const winningMoves = playMoves.filter((m) => wouldWin(findCardById(hand, m.cardId), leadCard, state.trumpSuit));
    if (isBrisque(leadCard) && winningMoves.length > 0) {
      return [...winningMoves].sort(
        (a, b) => rankValue(findCardById(hand, a.cardId).rank) - rankValue(findCardById(hand, b.cardId).rank),
      )[0]!;
    }
    return leastValuable(playMoves, hand);
  }

  // Endgame follow: getLegalMoves already enforced must-follow/must-win, so just avoid waste.
  return leastValuable(playMoves, hand);
}

export class ClubPlayerAgent implements Agent {
  constructor(
    private readonly playerId: PlayerId,
    private readonly thinkingDelayMs: number = 500,
  ) {}

  async chooseMove(state: GameState, legalMoves: Move[]): Promise<Move> {
    const move = chooseClubPlayerMove(state, this.playerId, legalMoves);
    if (this.thinkingDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.thinkingDelayMs));
    }
    return move;
  }
}
