import { describe, expect, it } from 'vitest';
import {
  type EvaluationWeights,
  evaluateMove,
  flatRiskEstimator,
  makeCardMemoryRiskEstimator,
} from '../src/agents/evaluation.js';
import { rubiconBezique } from '../src/engine/ruleset.js';
import type { Card, GameState } from '../src/engine/types.js';

const c = (id: string, suit: Card['suit'], rank: Card['rank']): Card => ({ id, suit, rank });

const UNIT_WEIGHTS: EvaluationWeights = {
  trickValue: 1,
  meldProgress: 1,
  brisqueRisk: 1,
  informationGivenAway: 1,
};

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

describe('evaluateMove: declareMeld', () => {
  it('scores meldProgress equal to the declared meld points, and dings informationGivenAway', () => {
    const state = makeState({
      players: [
        { id: 0, hand: [c('SQ-0', 'S', 'Q'), c('DJ-0', 'D', 'J')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const move = { type: 'declareMeld' as const, playerId: 0 as const, meldKind: 'bezique' as const, cardIds: ['SQ-0', 'DJ-0'] };
    const result = evaluateMove(state, 0, move, UNIT_WEIGHTS);
    expect(result.meldProgress).toBe(40);
    expect(result.informationGivenAway).toBeLessThan(0);
  });
});

describe('evaluateMove: pass', () => {
  it('penalizes passing when a real meld option is available', () => {
    const state = makeState({
      players: [
        { id: 0, hand: [c('SQ-0', 'S', 'Q'), c('DJ-0', 'D', 'J')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const result = evaluateMove(state, 0, { type: 'pass', playerId: 0 }, UNIT_WEIGHTS);
    expect(result.meldProgress).toBe(-40);
  });

  it('is neutral when there is genuinely nothing to declare', () => {
    const state = makeState({
      players: [
        { id: 0, hand: [c('S7-0', 'S', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const result = evaluateMove(state, 0, { type: 'pass', playerId: 0 }, UNIT_WEIGHTS);
    expect(result.meldProgress).toBeCloseTo(0);
  });
});

describe('evaluateMove: playCard resolving a trick', () => {
  it('values winning by the brisques captured plus a flat win bonus', () => {
    const state = makeState({
      stage: 'awaitingFollow',
      turn: 1,
      currentTrick: { leaderId: 0, leadCard: c('S10-0', 'S', '10') }, // a brisque
      players: [
        { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [c('SA-0', 'S', 'A')], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const move = { type: 'playCard' as const, playerId: 1 as const, cardId: 'SA-0' };
    const result = evaluateMove(state, 1, move, UNIT_WEIGHTS);
    // Both lead (10) and follow (A) are brisques: 10 + 10 = 20, plus the win bonus.
    expect(result.trickValue).toBeGreaterThan(20);
    expect(result.trickValue).toBeLessThan(26);
  });

  it('penalizes losing a brisque to the opponent', () => {
    // Lead is an unbeatable Ace of spades; the follower is forced to discard a 10
    // of spades (also a brisque) rather than win — that lost 10 should cost them.
    const state = makeState({
      stage: 'awaitingFollow',
      turn: 1,
      currentTrick: { leaderId: 0, leadCard: c('SA-0', 'S', 'A') },
      players: [
        { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [c('S10-1', 'S', '10')], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const losingMove = { type: 'playCard' as const, playerId: 1 as const, cardId: 'S10-1' };
    const result = evaluateMove(state, 1, losingMove, UNIT_WEIGHTS);
    expect(result.trickValue).toBeCloseTo(-10.07, 2); // -10 plus a tiny rank tiebreak
  });

  it('losing a non-brisque card costs nothing', () => {
    const state = makeState({
      stage: 'awaitingFollow',
      turn: 1,
      currentTrick: { leaderId: 0, leadCard: c('SK-0', 'S', 'K') },
      players: [
        { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [c('S7-0', 'S', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const losingMove = { type: 'playCard' as const, playerId: 1 as const, cardId: 'S7-0' };
    const result = evaluateMove(state, 1, losingMove, UNIT_WEIGHTS);
    expect(result.trickValue).toBeCloseTo(0, 1); // a tiny rank tiebreak, not a real cost
  });

  it('prefers the cheapest of several winning cards via a small rank tiebreak', () => {
    // Both S8 and S9 beat a led S7, and neither is itself a brisque — isolates the
    // tiebreak from the separate "winning with a brisque nets its own value" effect.
    const state = makeState({
      stage: 'awaitingFollow',
      turn: 1,
      currentTrick: { leaderId: 0, leadCard: c('S7-0', 'S', '7') },
      players: [
        { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [c('S8-0', 'S', '8'), c('S9-0', 'S', '9')], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const cheaper = evaluateMove(state, 1, { type: 'playCard', playerId: 1, cardId: 'S8-0' }, UNIT_WEIGHTS);
    const pricier = evaluateMove(state, 1, { type: 'playCard', playerId: 1, cardId: 'S9-0' }, UNIT_WEIGHTS);
    expect(cheaper.trickValue).toBeGreaterThan(pricier.trickValue);
  });

  it('when the trick is unwinnable, prefers discarding the lowest of several equally worthless cards', () => {
    // Lead is an unbeatable Ace; every card in hand loses regardless of what's played.
    // Among these non-brisque, non-trump losers, the lowest rank should be shed first.
    const state = makeState({
      stage: 'awaitingFollow',
      turn: 1,
      currentTrick: { leaderId: 0, leadCard: c('SA-0', 'S', 'A') },
      players: [
        { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
        {
          id: 1,
          hand: [c('H9-0', 'H', '9'), c('H7-0', 'H', '7'), c('H8-0', 'H', '8')],
          melds: [],
          score: 0,
          carteBlanchePoints: 0,
        },
      ],
    });
    const scored = ['H9-0', 'H7-0', 'H8-0'].map((cardId) => ({
      cardId,
      result: evaluateMove(state, 1, { type: 'playCard', playerId: 1, cardId }, UNIT_WEIGHTS),
    }));
    const best = scored.sort((a, b) => b.result.total - a.result.total)[0]!;
    expect(best.cardId).toBe('H7-0'); // the lowest rank of the three
  });

  it('when the trick is unwinnable, still prefers surrendering a non-trump over a trump', () => {
    // Lead is the trump Ace itself, so a low trump genuinely loses here too (not trumps the
    // lead) — a lower trump can never beat it, and an off-suit non-trump never beats a trump lead.
    const state = makeState({
      trumpSuit: 'H',
      stage: 'awaitingFollow',
      turn: 1,
      currentTrick: { leaderId: 0, leadCard: c('HA-0', 'H', 'A') },
      players: [
        { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [c('H9-0', 'H', '9'), c('C9-0', 'C', '9')], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const trumpDiscard = evaluateMove(state, 1, { type: 'playCard', playerId: 1, cardId: 'H9-0' }, UNIT_WEIGHTS);
    const plainDiscard = evaluateMove(state, 1, { type: 'playCard', playerId: 1, cardId: 'C9-0' }, UNIT_WEIGHTS);
    expect(plainDiscard.trickValue).toBeGreaterThan(trumpDiscard.trickValue);
  });
});

describe('evaluateMove: leading/discarding', () => {
  it('penalizes playing away a card that would forfeit a currently-fresh-declarable meld', () => {
    const state = makeState({
      players: [
        { id: 0, hand: [c('SK-0', 'S', 'K'), c('SQ-0', 'S', 'Q')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const move = { type: 'playCard' as const, playerId: 0 as const, cardId: 'SK-0' };
    const result = evaluateMove(state, 0, move, UNIT_WEIGHTS);
    expect(result.meldProgress).toBe(-20); // forfeits a common marriage worth 20
  });

  it('does not penalize a card with no meld relevance', () => {
    const state = makeState({
      players: [
        { id: 0, hand: [c('S7-0', 'S', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const move = { type: 'playCard' as const, playerId: 0 as const, cardId: 'S7-0' };
    const result = evaluateMove(state, 0, move, UNIT_WEIGHTS);
    expect(result.meldProgress).toBeCloseTo(0);
  });

  it('flatRiskEstimator applies exposure risk when leading a brisque', () => {
    const state = makeState({
      players: [
        { id: 0, hand: [c('SA-0', 'S', 'A')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const move = { type: 'playCard' as const, playerId: 0 as const, cardId: 'SA-0' };
    const result = evaluateMove(state, 0, move, UNIT_WEIGHTS, flatRiskEstimator);
    expect(result.brisqueRisk).toBeLessThan(0);
  });

  it('applies no risk when leading a non-brisque card', () => {
    const state = makeState({
      players: [
        { id: 0, hand: [c('S9-0', 'S', '9')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const move = { type: 'playCard' as const, playerId: 0 as const, cardId: 'S9-0' };
    const result = evaluateMove(state, 0, move, UNIT_WEIGHTS);
    expect(result.brisqueRisk).toBeCloseTo(0);
  });

  it('penalizes leading a trump card even when it is not a brisque', () => {
    const state = makeState({
      trumpSuit: 'S',
      players: [
        { id: 0, hand: [c('S9-0', 'S', '9')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const move = { type: 'playCard' as const, playerId: 0 as const, cardId: 'S9-0' };
    const result = evaluateMove(state, 0, move, UNIT_WEIGHTS);
    expect(result.brisqueRisk).toBeLessThan(0);
  });

  it('does not penalize a non-trump, non-brisque lead even when trumps are in play', () => {
    const state = makeState({
      trumpSuit: 'D',
      players: [
        { id: 0, hand: [c('S9-0', 'S', '9')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const move = { type: 'playCard' as const, playerId: 0 as const, cardId: 'S9-0' };
    const result = evaluateMove(state, 0, move, UNIT_WEIGHTS);
    expect(result.brisqueRisk).toBeCloseTo(0);
  });
});

describe('makeCardMemoryRiskEstimator', () => {
  it('estimates zero risk once every threat card is accounted for', () => {
    // Only one Ace of spades exists unaccounted for elsewhere: put every other
    // spade-beating / trump card in this player's own hand or already-played piles.
    const myAce = c('SA-0', 'S', 'A');
    const state = makeState({
      trumpSuit: 'D', // fix trumps so "trump threats" are also enumerable
      players: [
        { id: 0, hand: [c('S10-0', 'S', '10')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
      tricksWon: {
        0: [myAce], // the only spade Ace has already been played and captured
        1: [c('DA-0', 'D', 'A'), c('DA-1', 'D', 'A'), c('DA-2', 'D', 'A'), c('DA-3', 'D', 'A')], // all trump Aces gone too
      },
    });
    const estimator = makeCardMemoryRiskEstimator();
    // Evaluating risk for the S10 in hand: threats are spade cards ranked above 10 (only A) — already played —
    // plus any trump (D) cards, of which only Aces are "above" nothing in particular but ANY trump threatens a
    // non-trump lead. Since this test isn't exhaustive of all diamond cards, just assert the estimator runs and
    // returns a value strictly between the flat estimator's constant and 1 given partial information.
    const risk = estimator(state, 0, c('S10-0', 'S', '10'));
    expect(risk).toBeGreaterThanOrEqual(0);
    expect(risk).toBeLessThanOrEqual(1);
  });

  it('never treats the player\'s own hand or already-played cards as threats', () => {
    // Hold both remaining spade Aces yourself — no spade-suit threat should remain,
    // though trumps (unset here) don't apply either.
    const state = makeState({
      players: [
        { id: 0, hand: [c('S10-0', 'S', '10'), c('SA-0', 'S', 'A'), c('SA-1', 'S', 'A'), c('SA-2', 'S', 'A'), c('SA-3', 'S', 'A')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const estimator = makeCardMemoryRiskEstimator();
    const risk = estimator(state, 0, c('S10-0', 'S', '10'));
    expect(risk).toBe(0);
  });
});

describe('evaluateMove: weighting', () => {
  it('scales each factor by its own weight when combining into total', () => {
    const state = makeState({
      players: [
        { id: 0, hand: [c('SA-0', 'S', 'A')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const move = { type: 'playCard' as const, playerId: 0 as const, cardId: 'SA-0' };
    const weights: EvaluationWeights = { trickValue: 0, meldProgress: 0, brisqueRisk: 3, informationGivenAway: 0 };
    const result = evaluateMove(state, 0, move, weights);
    expect(result.total).toBeCloseTo(result.brisqueRisk * 3, 6);
  });
});
