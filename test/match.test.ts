import { describe, expect, it } from 'vitest';
import { finalizeDealScore } from '../src/engine/scoring.js';
import { finalizeMatchDeal, startMatch, startNextMatchDeal, type MatchState } from '../src/engine/match.js';
import { makeRng } from '../src/engine/deck.js';
import { rubiconBezique } from '../src/engine/ruleset.js';
import type { Card, GameState, Ruleset } from '../src/engine/types.js';

const c = (id: string, suit: Card['suit'], rank: Card['rank']): Card => ({ id, suit, rank });

/** Classic Bezique-shaped ruleset: cumulative match to 1,000, brisques always count. */
const matchRuleset: Ruleset = {
  ...rubiconBezique,
  brisquesAlwaysCount: true,
  carteBlanchePoints: 0,
  matchMode: { kind: 'cumulativeToTarget', targetScore: 1000 },
};

function makeDealState(overrides: Partial<GameState> = {}): GameState {
  const base: GameState = {
    ruleset: matchRuleset,
    deck: [],
    players: [
      { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
    ],
    trumpSuit: 'S',
    turnUpCard: null,
    phase: 'scoring',
    stage: 'awaitingLead',
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

describe('finalizeDealScore', () => {
  it('folds brisques unconditionally into each player\'s own score, with no rounding', () => {
    const state = makeDealState({
      players: [
        { id: 0, hand: [], melds: [], score: 250, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 90, carteBlanchePoints: 0 },
      ],
      tricksWon: {
        0: [c('SA-0', 'S', 'A'), c('S10-0', 'S', '10')], // 20 pts
        1: [c('HA-0', 'H', 'A')], // 10 pts
      },
    });
    const result = finalizeDealScore(state);
    expect(result.phase).toBe('complete');
    expect(result.players[0].score).toBe(270);
    expect(result.players[1].score).toBe(100);
  });

  it('throws if called outside the scoring phase', () => {
    expect(() => finalizeDealScore(makeDealState({ phase: 'main' }))).toThrow();
  });

  it('throws for a singleHandComplete ruleset', () => {
    expect(() => finalizeDealScore(makeDealState({ ruleset: rubiconBezique, phase: 'scoring' }))).toThrow();
  });
});

describe('startMatch', () => {
  it('starts a fresh match at 0-0 with a freshly dealt hand', () => {
    const match = startMatch(matchRuleset, 1, makeRng(1));
    expect(match.scores).toEqual({ 0: 0, 1: 0 });
    expect(match.dealerId).toBe(1);
    expect(match.winnerId).toBeNull();
    expect(match.deal.phase).toBe('main');
    expect(match.deal.players[0].hand).toHaveLength(matchRuleset.cardsPerPlayer);
  });

  it('throws for a singleHandComplete ruleset', () => {
    expect(() => startMatch(rubiconBezique, 1, makeRng(1))).toThrow();
  });
});

describe('finalizeMatchDeal', () => {
  function makeMatch(overrides: Partial<MatchState> = {}): MatchState {
    return {
      ruleset: matchRuleset,
      scores: { 0: 0, 1: 0 },
      dealerId: 1,
      deal: makeDealState(),
      winnerId: null,
      ...overrides,
    };
  }

  it('adds the finalized deal score onto the running match totals', () => {
    const match = makeMatch({
      scores: { 0: 400, 1: 300 },
      deal: makeDealState({
        players: [
          { id: 0, hand: [], melds: [], score: 150, carteBlanchePoints: 0 },
          { id: 1, hand: [], melds: [], score: 80, carteBlanchePoints: 0 },
        ],
      }),
    });
    const next = finalizeMatchDeal(match);
    expect(next.scores).toEqual({ 0: 550, 1: 380 });
    expect(next.deal.phase).toBe('complete');
  });

  it('declares no winner while both players are under the target', () => {
    const match = makeMatch({
      scores: { 0: 700, 1: 600 },
      deal: makeDealState({
        players: [
          { id: 0, hand: [], melds: [], score: 100, carteBlanchePoints: 0 },
          { id: 1, hand: [], melds: [], score: 50, carteBlanchePoints: 0 },
        ],
      }),
    });
    const next = finalizeMatchDeal(match);
    expect(next.scores).toEqual({ 0: 800, 1: 650 });
    expect(next.winnerId).toBeNull();
  });

  it('declares the strictly-higher player the winner once at least one crosses the target', () => {
    const match = makeMatch({
      scores: { 0: 900, 1: 950 },
      deal: makeDealState({
        players: [
          { id: 0, hand: [], melds: [], score: 50, carteBlanchePoints: 0 }, // -> 950
          { id: 1, hand: [], melds: [], score: 60, carteBlanchePoints: 0 }, // -> 1010
        ],
      }),
    });
    const next = finalizeMatchDeal(match);
    expect(next.scores).toEqual({ 0: 950, 1: 1010 });
    expect(next.winnerId).toBe(1);
  });

  it('leaves the match undecided on an exact tie at or above the target (spec silent on this case)', () => {
    const match = makeMatch({
      scores: { 0: 950, 1: 950 },
      deal: makeDealState({
        players: [
          { id: 0, hand: [], melds: [], score: 60, carteBlanchePoints: 0 }, // -> 1010
          { id: 1, hand: [], melds: [], score: 60, carteBlanchePoints: 0 }, // -> 1010
        ],
      }),
    });
    const next = finalizeMatchDeal(match);
    expect(next.scores).toEqual({ 0: 1010, 1: 1010 });
    expect(next.winnerId).toBeNull();
  });
});

describe('startNextMatchDeal', () => {
  it('alternates the dealer and deals a fresh hand', () => {
    const match = startMatch(matchRuleset, 1, makeRng(1));
    const next = startNextMatchDeal(match, makeRng(2));
    expect(next.dealerId).toBe(0);
    expect(next.deal).not.toBe(match.deal);
  });

  it('is a no-op once the match has a winner', () => {
    const match: MatchState = {
      ruleset: matchRuleset,
      scores: { 0: 1050, 1: 800 },
      dealerId: 1,
      deal: makeDealState({ phase: 'complete' }),
      winnerId: 0,
    };
    const next = startNextMatchDeal(match, makeRng(1));
    expect(next).toBe(match);
  });
});
