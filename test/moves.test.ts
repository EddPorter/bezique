import { describe, expect, it } from 'vitest';
import { applyMove, getLegalMoves } from '../src/engine/moves.js';
import { rubiconBezique } from '../src/engine/ruleset.js';
import type { Card, GameState, PlayerId } from '../src/engine/types.js';

const c = (id: string, suit: Card['suit'], rank: Card['rank']): Card => ({ id, suit, rank });

/** Hand-built minimal state so tests don't depend on shuffle/deal internals. */
function makeState(overrides: Partial<GameState> = {}): GameState {
  const base: GameState = {
    ruleset: rubiconBezique,
    deck: [],
    players: [
      { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
    ],
    trumpSuit: null,
    phase: 'main',
    stage: 'awaitingLead',
    currentTrick: { leaderId: 0, leadCard: null },
    tricksWon: { 0: [], 1: [] },
    cardMeldClassUsage: {},
    turn: 0,
    dealerId: 1,
    lastTrickWinnerId: null,
    history: [],
  };
  return { ...base, ...overrides };
}

describe('getLegalMoves', () => {
  it('offers only the cards in the current player\'s hand to lead', () => {
    const state = makeState({
      players: [
        { id: 0, hand: [c('SK-0', 'S', 'K'), c('SQ-0', 'S', 'Q')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const moves = getLegalMoves(state, 0);
    expect(moves).toHaveLength(2);
    expect(moves.every((m) => m.type === 'playCard')).toBe(true);
  });

  it('returns nothing for a player who is not on turn', () => {
    const state = makeState({ turn: 0 });
    expect(getLegalMoves(state, 1)).toHaveLength(0);
  });

  it('main phase: follower may play any card, no suit restriction', () => {
    const state = makeState({
      stage: 'awaitingFollow',
      turn: 1,
      currentTrick: { leaderId: 0, leadCard: c('SA-0', 'S', 'A') },
      players: [
        { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [c('H7-0', 'H', '7'), c('S7-0', 'S', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    expect(getLegalMoves(state, 1)).toHaveLength(2);
  });

  it('endgame: follower must follow suit and win with it if possible', () => {
    const state = makeState({
      phase: 'endgame',
      stage: 'awaitingFollow',
      turn: 1,
      trumpSuit: 'H',
      currentTrick: { leaderId: 0, leadCard: c('S7-0', 'S', '7') },
      players: [
        { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
        {
          id: 1,
          hand: [c('S8-0', 'S', '8'), c('SK-0', 'S', 'K'), c('HA-0', 'H', 'A')],
          melds: [],
          score: 0,
          carteBlanchePoints: 0,
        },
      ],
    });
    const moves = getLegalMoves(state, 1);
    // Must follow suit (spades) and win: S8 and SK both beat S7; the trump HA-0 is illegal (can follow suit).
    expect(moves.map((m) => (m as { cardId: string }).cardId).sort()).toEqual(['S8-0', 'SK-0']);
  });

  it('endgame: void in led suit with a trump available must trump', () => {
    const state = makeState({
      phase: 'endgame',
      stage: 'awaitingFollow',
      turn: 1,
      trumpSuit: 'H',
      currentTrick: { leaderId: 0, leadCard: c('S7-0', 'S', '7') },
      players: [
        { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [c('H7-0', 'H', '7'), c('D8-0', 'D', '8')], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const moves = getLegalMoves(state, 1);
    expect(moves).toEqual([{ type: 'playCard', playerId: 1, cardId: 'H7-0' }]);
  });

  it('endgame: void in led suit with no trump may play anything', () => {
    const state = makeState({
      phase: 'endgame',
      stage: 'awaitingFollow',
      turn: 1,
      trumpSuit: 'H',
      currentTrick: { leaderId: 0, leadCard: c('S7-0', 'S', '7') },
      players: [
        { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [c('D8-0', 'D', '8'), c('C9-0', 'C', '9')], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    expect(getLegalMoves(state, 1)).toHaveLength(2);
  });
});

describe('applyMove: a full trick with meld window and draw', () => {
  it('resolves the trick, lets the winner declare a meld, then draws for both players', () => {
    let state = makeState({
      deck: [c('SA-1', 'S', 'A'), c('H7-1', 'H', '7')],
      players: [
        { id: 0, hand: [c('SA-0', 'S', 'A')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [c('S7-0', 'S', '7'), c('SK-0', 'S', 'K'), c('SQ-0', 'S', 'Q')], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
      turn: 0,
    });

    // 0 leads the Ace of spades
    state = applyMove(state, { type: 'playCard', playerId: 0, cardId: 'SA-0' });
    expect(state.stage).toBe('awaitingFollow');
    expect(state.turn).toBe(1);

    // 1 follows with a losing 7 of spades -> 0 wins the trick
    state = applyMove(state, { type: 'playCard', playerId: 1, cardId: 'S7-0' });
    expect(state.stage).toBe('awaitingMeldDecision');
    expect(state.turn).toBe(0);
    expect(state.tricksWon[0].map((c) => c.id).sort()).toEqual(['S7-0', 'SA-0'].sort());

    // 0 has no meld available (hand now empty), so passes
    state = applyMove(state, { type: 'pass', playerId: 0 });
    expect(state.stage).toBe('awaitingLead');
    expect(state.turn).toBe(0); // winner leads next
    expect(state.players[0].hand.map((c) => c.id)).toEqual(['SA-1']);
    expect(state.players[1].hand.map((c) => c.id).sort()).toEqual(['H7-1', 'SK-0', 'SQ-0'].sort());
    expect(state.deck).toHaveLength(0);
    expect(state.phase).toBe('endgame'); // stock now empty
  });

  it('a declared marriage sets trumps and scores points, then the meld window closes on declaration', () => {
    let state = makeState({
      deck: [c('S9-1', 'S', '9'), c('H9-1', 'H', '9')],
      players: [
        { id: 0, hand: [c('SA-0', 'S', 'A'), c('SK-0', 'S', 'K'), c('SQ-0', 'S', 'Q')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [c('S7-0', 'S', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
      turn: 0,
    });

    state = applyMove(state, { type: 'playCard', playerId: 0, cardId: 'SA-0' });
    state = applyMove(state, { type: 'playCard', playerId: 1, cardId: 'S7-0' });
    expect(state.trumpSuit).toBeNull();

    state = applyMove(state, {
      type: 'declareMeld',
      playerId: 0,
      meldKind: 'marriage',
      cardIds: ['SK-0', 'SQ-0'],
    });
    expect(state.trumpSuit).toBe('S');
    expect(state.players[0].score).toBe(40); // trump marriage
    expect(state.players[0].melds).toHaveLength(1);
    expect(state.stage).toBe('awaitingLead'); // draw happened automatically after the single meld
  });

  it('reconstructs a marriage using a fresh, never-melded duplicate as the spare (reported by a user)', () => {
    // K♥+Q♥ already declared and scored; the original King has since been played away
    // (captured in tricksWon), and the player holds a second, entirely fresh King of Hearts
    // that was never part of any other meld.
    const existingMarriage = {
      id: 'marriage-1',
      kind: 'marriage' as const,
      class: 'sequence' as const,
      suit: 'H' as const,
      cardIds: ['HK-0', 'HQ-0'],
      points: 40,
      declaredAtMoveIndex: 1,
      lastScoredAtMoveIndex: 1,
    };
    let state = makeState({
      stage: 'awaitingMeldDecision',
      trumpSuit: 'H',
      turn: 0,
      cardMeldClassUsage: { 'HK-0': { sequence: 0 }, 'HQ-0': { sequence: 0 } },
      tricksWon: { 0: [c('HK-0', 'H', 'K'), c('S7-0', 'S', '7')], 1: [] },
      players: [
        {
          id: 0,
          hand: [c('HQ-0', 'H', 'Q'), c('HK-1', 'H', 'K')],
          melds: [existingMarriage],
          score: 40,
          carteBlanchePoints: 0,
        },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });

    const legalMoves = getLegalMoves(state, 0);
    const replacementMove = legalMoves.find(
      (m) => m.type === 'declareMeld' && m.cardIds.includes('HK-1'),
    );
    expect(replacementMove).toBeDefined();

    state = applyMove(state, replacementMove!);
    expect(state.players[0].score).toBe(80); // the trump marriage scored again
    expect(state.players[0].melds).toHaveLength(2);
    // The fresh spare must now be tracked, or it could illegally re-declare downward later.
    expect(state.cardMeldClassUsage['HK-1']?.sequence).toBe(0);
  });

  it('rejects a move played out of turn', () => {
    const state = makeState({
      players: [
        { id: 0, hand: [c('SA-0', 'S', 'A')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [c('S7-0', 'S', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
      turn: 0,
    });
    expect(() => applyMove(state, { type: 'playCard', playerId: 1, cardId: 'S7-0' })).toThrow();
  });

  it('rejects an illegal endgame follow that fails to follow suit', () => {
    const state = makeState({
      phase: 'endgame',
      stage: 'awaitingFollow',
      turn: 1,
      trumpSuit: 'H',
      currentTrick: { leaderId: 0, leadCard: c('S7-0', 'S', '7') },
      players: [
        { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [c('SK-0', 'S', 'K'), c('D8-0', 'D', '8')], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    expect(() => applyMove(state, { type: 'playCard', playerId: 1, cardId: 'D8-0' })).toThrow();
  });
});

describe('applyMove: endgame into scoring', () => {
  it('awards the last-trick bonus and moves to the scoring phase once both hands are empty', () => {
    let state = makeState({
      phase: 'endgame',
      stage: 'awaitingLead',
      turn: 0,
      currentTrick: { leaderId: 0, leadCard: null },
      players: [
        { id: 0, hand: [c('SA-0', 'S', 'A')], melds: [], score: 100, carteBlanchePoints: 0 },
        { id: 1, hand: [c('S7-0', 'S', '7')], melds: [], score: 200, carteBlanchePoints: 0 },
      ],
    });
    state = applyMove(state, { type: 'playCard', playerId: 0, cardId: 'SA-0' });
    state = applyMove(state, { type: 'playCard', playerId: 1, cardId: 'S7-0' });
    expect(state.phase).toBe('scoring');
    expect(state.players[0].score).toBe(150); // 100 + 50 last-trick bonus (0 won the trick)
  });
});
