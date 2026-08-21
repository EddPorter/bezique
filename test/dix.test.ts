import { describe, expect, it } from 'vitest';
import { applyMove, getLegalMoves } from '../src/engine/moves.js';
import { dealNewHand } from '../src/engine/state.js';
import { makeRng } from '../src/engine/deck.js';
import { rubiconBezique } from '../src/engine/ruleset.js';
import type { Card, GameState, Ruleset } from '../src/engine/types.js';

const c = (id: string, suit: Card['suit'], rank: Card['rank']): Card => ({ id, suit, rank });

/** Classic Bezique-shaped ruleset: turned-up trump plus a scoring dix. carteBlanchePoints is
 * zeroed out so these tests' minimal, court-card-free hands don't accidentally trigger it. */
const dixRuleset: Ruleset = {
  ...rubiconBezique,
  trumpDetermination: 'turnedUpCard',
  dix: { points: 10 },
  carteBlanchePoints: 0,
};

function makeState(overrides: Partial<GameState> = {}): GameState {
  const base: GameState = {
    ruleset: dixRuleset,
    deck: [],
    players: [
      { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
    ],
    trumpSuit: 'S',
    turnUpCard: null,
    phase: 'main',
    stage: 'awaitingMeldDecision',
    currentTrick: { leaderId: 0, leadCard: null },
    tricksWon: { 0: [], 1: [] },
    cardMeldClassUsage: {},
    dixScoredCardIds: {},
    turn: 0,
    dealerId: 1,
    lastTrickWinnerId: 0,
    history: [],
  };
  return { ...base, ...overrides };
}

describe('dealNewHand: dealer bonus when the turn-up card is itself the dix', () => {
  it('scores the dealer ruleset.dix.points whenever, and only whenever, the turn-up is a 7', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const dealerId = seed % 2 === 0 ? 0 : 1;
      const state = dealNewHand(dixRuleset, dealerId, makeRng(seed));
      const expectedBonus = state.turnUpCard?.rank === '7' ? dixRuleset.dix!.points : 0;
      expect(state.players[dealerId].score).toBe(expectedBonus);
      expect(state.players[dealerId === 0 ? 1 : 0].score).toBe(0);
    }
  });
});

describe('getLegalMoves: declareDix', () => {
  it('offers declareDix for a held, unscored dix during the meld-decision window', () => {
    const state = makeState({
      players: [
        { id: 0, hand: [c('S7-0', 'S', '7'), c('H9-0', 'H', '9')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const moves = getLegalMoves(state, 0);
    expect(moves).toContainEqual({ type: 'declareDix', playerId: 0, cardId: 'S7-0' });
  });

  it('does not offer a 7 of a non-trump suit', () => {
    const state = makeState({
      players: [
        { id: 0, hand: [c('H7-0', 'H', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    expect(getLegalMoves(state, 0).some((m) => m.type === 'declareDix')).toBe(false);
  });

  it('does not re-offer a dix that has already been scored', () => {
    const state = makeState({
      players: [
        { id: 0, hand: [c('S7-0', 'S', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
      dixScoredCardIds: { 'S7-0': true },
    });
    expect(getLegalMoves(state, 0).some((m) => m.type === 'declareDix')).toBe(false);
  });

  it('never offers declareDix for a ruleset with no dix mechanic', () => {
    const state = makeState({
      ruleset: rubiconBezique,
      players: [
        { id: 0, hand: [c('S7-0', 'S', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    expect(getLegalMoves(state, 0).some((m) => m.type === 'declareDix')).toBe(false);
  });
});

describe('applyMove: declareDix', () => {
  it('exchanges the declared dix for the turn-up card and scores dix.points', () => {
    const state = makeState({
      deck: [c('C8-0', 'C', '8')], // so drawing after the window has something to draw
      turnUpCard: c('SK-0', 'S', 'K'),
      players: [
        { id: 0, hand: [c('S7-0', 'S', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const next = applyMove(state, { type: 'declareDix', playerId: 0, cardId: 'S7-0' });

    expect(next.players[0].score).toBe(10);
    expect(next.turnUpCard).toBeNull();
    const handIds = next.players[0].hand.map((card) => card.id);
    expect(handIds).not.toContain('S7-0');
    // The turn-up card (SK-0) entered the hand, then the post-window draw gave a second card.
    expect(handIds).toContain('SK-0');
  });

  it('scores with no exchange when the turn-up card has already been claimed', () => {
    const state = makeState({
      deck: [c('C8-0', 'C', '8')],
      turnUpCard: null, // already exchanged earlier this deal
      players: [
        { id: 0, hand: [c('S7-0', 'S', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const next = applyMove(state, { type: 'declareDix', playerId: 0, cardId: 'S7-0' });

    expect(next.players[0].score).toBe(10);
    // The declared dix stays in hand — it just can't be declared again.
    expect(next.players[0].hand.map((card) => card.id)).toContain('S7-0');
    expect(next.dixScoredCardIds['S7-0']).toBe(true);
  });

  it('blocks re-declaring the same dix card a second time', () => {
    let state = makeState({
      deck: [c('C8-0', 'C', '8'), c('C9-0', 'C', '9')],
      turnUpCard: null,
      players: [
        { id: 0, hand: [c('S7-0', 'S', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    state = applyMove(state, { type: 'declareDix', playerId: 0, cardId: 'S7-0' });
    // Force back into a fresh meld-decision window as the same player, as other tests do.
    state = { ...state, stage: 'awaitingMeldDecision', turn: 0 };
    expect(
      getLegalMoves(state, 0).some((m) => m.type === 'declareDix' && m.cardId === 'S7-0'),
    ).toBe(false);
    expect(() => applyMove(state, { type: 'declareDix', playerId: 0, cardId: 'S7-0' })).toThrow();
  });

  it('marks an exchanged-in card as already scored if it happens to be a dix itself, blocking a double-dip', () => {
    // The turn-up card is itself a 7 of trumps (rare) — exchanging for it must not hand the
    // declarer a second declarable dix for free.
    const state = makeState({
      deck: [c('C8-0', 'C', '8')],
      turnUpCard: c('S7-1', 'S', '7'),
      players: [
        { id: 0, hand: [c('S7-0', 'S', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    let next = applyMove(state, { type: 'declareDix', playerId: 0, cardId: 'S7-0' });
    expect(next.players[0].score).toBe(10);
    expect(next.dixScoredCardIds['S7-1']).toBe(true);

    next = { ...next, stage: 'awaitingMeldDecision', turn: 0 };
    expect(getLegalMoves(next, 0).some((m) => m.type === 'declareDix')).toBe(false);
  });
});
