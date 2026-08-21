import { describe, expect, it } from 'vitest';
import { getTutorAdvice } from '../src/agents/tutor.js';
import { rubiconBezique } from '../src/engine/ruleset.js';
import type { Card, GameState } from '../src/engine/types.js';
import { getLegalMoves } from '../src/engine/moves.js';

const c = (id: string, suit: Card['suit'], rank: Card['rank']): Card => ({ id, suit, rank });

function makeState(overrides: Partial<GameState> = {}): GameState {
  const base: GameState = {
    ruleset: rubiconBezique,
    deck: [],
    players: [
      { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
    ],
    trumpSuit: null,
    turnUpCard: null,
    phase: 'main',
    stage: 'awaitingLead',
    currentTrick: { leaderId: 0, leadCard: null },
    tricksWon: { 0: [], 1: [] },
    cardMeldClassUsage: {},
    dixScoredCardIds: {},
    turn: 0,
    dealerId: 1,
    lastTrickWinnerId: null,
    history: [],
  };
  return { ...base, ...overrides };
}

describe('getTutorAdvice', () => {
  it('returns null when there are no legal moves', () => {
    const state = makeState();
    expect(getTutorAdvice(state, 0, [])).toBeNull();
  });

  it('recommends declaring the meld, with points named in the explanation', () => {
    const state = makeState({
      stage: 'awaitingMeldDecision',
      turn: 0,
      players: [
        { id: 0, hand: [c('SQ-0', 'S', 'Q'), c('DJ-0', 'D', 'J')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const advice = getTutorAdvice(state, 0, getLegalMoves(state, 0))!;
    expect(advice.move.type).toBe('declareMeld');
    expect(advice.explanation).toContain('Bezique');
    expect(advice.explanation).toContain('40');
  });

  it('explains a forced single legal card plainly', () => {
    const state = makeState({
      players: [
        { id: 0, hand: [c('S7-0', 'S', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const advice = getTutorAdvice(state, 0, getLegalMoves(state, 0))!;
    expect(advice.move).toEqual({ type: 'playCard', playerId: 0, cardId: 'S7-0' });
    expect(advice.explanation).toMatch(/only legal card/);
    expect(advice.alternatives).toEqual([]); // nothing else to explain away
  });

  it('explains why declining to declare leaves points on the table', () => {
    const state = makeState({
      stage: 'awaitingMeldDecision',
      turn: 0,
      players: [
        { id: 0, hand: [c('SQ-0', 'S', 'Q'), c('DJ-0', 'D', 'J')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const advice = getTutorAdvice(state, 0, getLegalMoves(state, 0))!;
    expect(advice.move.type).toBe('declareMeld');
    const passAlternative = advice.alternatives.find((a) => a.move.type === 'pass');
    expect(passAlternative).toBeDefined();
    expect(passAlternative!.reason).toMatch(/40 points undeclared/);
  });

  it('recommends winning a trick and names the captured brisque', () => {
    const state = makeState({
      stage: 'awaitingFollow',
      turn: 1,
      currentTrick: { leaderId: 0, leadCard: c('S10-0', 'S', '10') },
      players: [
        { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [c('SA-0', 'S', 'A'), c('H7-0', 'H', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const advice = getTutorAdvice(state, 1, getLegalMoves(state, 1))!;
    expect(advice.move).toEqual({ type: 'playCard', playerId: 1, cardId: 'SA-0' });
    expect(advice.explanation).toMatch(/wins the trick/);
    expect(advice.explanation).toMatch(/brisque/);
    // The tutor should also justify the card it did NOT recommend, not just the winner.
    const loserAlternative = advice.alternatives.find(
      (a) => a.move.type === 'playCard' && a.move.cardId === 'H7-0',
    );
    expect(loserAlternative).toBeDefined();
    expect(loserAlternative!.reason).toMatch(/loses the trick/);
  });

  it('recommends the card that keeps meld potential alive over one that would forfeit it', () => {
    const state = makeState({
      players: [
        {
          id: 0,
          hand: [c('SK-0', 'S', 'K'), c('SQ-0', 'S', 'Q'), c('H7-0', 'H', '7')],
          melds: [],
          score: 0,
          carteBlanchePoints: 0,
        },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const advice = getTutorAdvice(state, 0, getLegalMoves(state, 0))!;
    // SK/SQ would forfeit the marriage if led away; H7 is unrelated and safe.
    expect(advice.move).toEqual({ type: 'playCard', playerId: 0, cardId: 'H7-0' });
    expect(advice.explanation).toMatch(/meld options open/);
    for (const cardId of ['SK-0', 'SQ-0']) {
      const alt = advice.alternatives.find((a) => a.move.type === 'playCard' && a.move.cardId === cardId);
      expect(alt).toBeDefined();
      expect(alt!.reason).toMatch(/meld potential/);
    }
  });

  it('recommends the safe lead over an exposed brisque when there is no meld difference', () => {
    // Trumps must be in play for an Ace to carry any real risk at all — with no trump
    // suit set, nothing can beat an Ace of any suit, so a card-memory-aware tutor
    // correctly sees zero risk in that case (verified separately below).
    const state = makeState({
      trumpSuit: 'D',
      players: [
        { id: 0, hand: [c('SA-0', 'S', 'A'), c('H9-0', 'H', '9')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const advice = getTutorAdvice(state, 0, getLegalMoves(state, 0))!;
    expect(advice.move).toEqual({ type: 'playCard', playerId: 0, cardId: 'H9-0' });
    expect(advice.explanation).toMatch(/safe to lead/);
  });

  it('recognizes a led Ace is unbeatable when no trump suit has been set yet', () => {
    const state = makeState({
      players: [
        { id: 0, hand: [c('SA-0', 'S', 'A'), c('H9-0', 'H', '9')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const advice = getTutorAdvice(state, 0, getLegalMoves(state, 0))!;
    for (const { breakdown } of advice.ranked) {
      // Only the tiny rank tiebreak remains (no real exposure with no trump suit set).
      expect(Math.abs(breakdown.brisqueRisk)).toBeLessThan(0.1);
    }
  });

  it('breaks a genuine tie by rank, not by which card happens to come first in hand (reported by a user)', () => {
    // Two cards with truly identical breakdowns before the tiebreak: neither is a brisque,
    // neither is trump, and neither has any meld relevance (a lone King with no Queen of its
    // suit, and a lone 7, in an otherwise empty hand). The HIGHER-rank card is listed FIRST
    // in hand deliberately — before the rank tiebreak, a stable sort on equal totals would
    // just return whichever came first in the array, which happened to look like "always
    // picks the first card in hand" from the outside.
    const state = makeState({
      players: [
        { id: 0, hand: [c('CK-0', 'C', 'K'), c('C7-0', 'C', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const advice = getTutorAdvice(state, 0, getLegalMoves(state, 0))!;
    expect(advice.move).toEqual({ type: 'playCard', playerId: 0, cardId: 'C7-0' });
  });

  it('prefers a non-trump lead over an equal-rank trump card, and says so', () => {
    // Same rank, same non-brisque status — the only difference is one is trump.
    // Before accounting for trump conservation, evaluateMove scored these identically
    // (both all-zero breakdowns), so the tutor fell back to "about as good as your
    // other options" even though conserving the trump is clearly better.
    const state = makeState({
      trumpSuit: 'S',
      players: [
        { id: 0, hand: [c('S9-0', 'S', '9'), c('H9-0', 'H', '9')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const advice = getTutorAdvice(state, 0, getLegalMoves(state, 0))!;
    expect(advice.move).toEqual({ type: 'playCard', playerId: 0, cardId: 'H9-0' });
    expect(advice.explanation).toMatch(/costs you no trump/);
  });

  it('recommends discarding the worst card when a trick is unwinnable, not just any losing card', () => {
    // Lead is the trump Ace itself, so even a low trump genuinely loses here (a lower trump
    // can't beat it) rather than winning by trumping a non-trump lead. Between a trump 9 and
    // a plain 7, both lose, but surrendering the trump costs strictly more.
    const state = makeState({
      trumpSuit: 'H',
      stage: 'awaitingFollow',
      turn: 0,
      currentTrick: { leaderId: 1, leadCard: c('HA-0', 'H', 'A') },
      players: [
        {
          id: 0,
          hand: [c('H9-0', 'H', '9'), c('C7-0', 'C', '7')],
          melds: [],
          score: 0,
          carteBlanchePoints: 0,
        },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const advice = getTutorAdvice(state, 0, getLegalMoves(state, 0))!;
    expect(advice.move).toEqual({ type: 'playCard', playerId: 0, cardId: 'C7-0' });
    expect(advice.explanation).toMatch(/gives up the least/);
  });

  it('among several equally worthless losing cards, still calls it a close call rather than overclaiming a reason', () => {
    // C7 and C9 are both cheap, non-trump, non-brisque discards — the gap between them is
    // negligible, so the tutor should say so rather than fabricate a decisive-sounding reason.
    const state = makeState({
      trumpSuit: 'H',
      stage: 'awaitingFollow',
      turn: 0,
      currentTrick: { leaderId: 1, leadCard: c('HA-0', 'H', 'A') },
      players: [
        {
          id: 0,
          hand: [c('C7-0', 'C', '7'), c('C9-0', 'C', '9')],
          melds: [],
          score: 0,
          carteBlanchePoints: 0,
        },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const advice = getTutorAdvice(state, 0, getLegalMoves(state, 0))!;
    expect(advice.move).toEqual({ type: 'playCard', playerId: 0, cardId: 'C7-0' });
    expect(advice.explanation).toMatch(/about as good as your other options/);
  });

  it('ranks every legal move in descending total order', () => {
    const state = makeState({
      players: [
        {
          id: 0,
          hand: [c('SA-0', 'S', 'A'), c('H9-0', 'H', '9'), c('C8-0', 'C', '8')],
          melds: [],
          score: 0,
          carteBlanchePoints: 0,
        },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const advice = getTutorAdvice(state, 0, getLegalMoves(state, 0))!;
    expect(advice.ranked).toHaveLength(3);
    for (let i = 1; i < advice.ranked.length; i++) {
      expect(advice.ranked[i - 1]!.breakdown.total).toBeGreaterThanOrEqual(advice.ranked[i]!.breakdown.total);
    }
  });
});
