import { describe, expect, it } from 'vitest';
import { finalizeScoring } from '../src/engine/scoring.js';
import { rubiconBezique } from '../src/engine/ruleset.js';
import type { Card, GameState } from '../src/engine/types.js';

const c = (id: string, suit: Card['suit'], rank: Card['rank']): Card => ({ id, suit, rank });

function makeScoringState(overrides: Partial<GameState> = {}): GameState {
  const base: GameState = {
    ruleset: rubiconBezique,
    deck: [],
    players: [
      { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
    ],
    trumpSuit: 'S',
    phase: 'scoring',
    stage: 'awaitingLead',
    currentTrick: { leaderId: 0, leadCard: null },
    tricksWon: { 0: [], 1: [] },
    cardMeldClassUsage: {},
    turn: 0,
    dealerId: 1,
    lastTrickWinnerId: 0,
    history: [],
  };
  return { ...base, ...overrides };
}

describe('finalizeScoring', () => {
  it('rounds down to the nearest 100 and awards 500 + the difference to the higher scorer', () => {
    const state = makeScoringState({
      players: [
        { id: 0, hand: [], melds: [], score: 1290, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 1050, carteBlanchePoints: 0 },
      ],
    });
    const result = finalizeScoring(state).result!;
    expect(result.roundedScores).toEqual({ 0: 1200, 1: 1000 });
    expect(result.winnerId).toBe(0);
    expect(result.rubiconed).toBe(false);
    expect(result.winnerFinalScore).toBe(500 + (1200 - 1000));
  });

  it('ignores brisques when melds alone already decide it clearly and avoid rubicon', () => {
    const state = makeScoringState({
      players: [
        { id: 0, hand: [], melds: [], score: 1500, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 1100, carteBlanchePoints: 0 },
      ],
      tricksWon: {
        0: [],
        1: [c('SA-0', 'S', 'A'), c('S10-0', 'S', '10')], // 20 pts of brisques, irrelevant here
      },
    });
    const result = finalizeScoring(state).result!;
    expect(result.roundedScores).toEqual({ 0: 1500, 1: 1100 });
  });

  it('counts brisques to break a meld-only tie', () => {
    // Both round to 1100 on melds alone; player 0's brisques push them over the next 100-boundary.
    const state = makeScoringState({
      players: [
        { id: 0, hand: [], melds: [], score: 1150, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 1150, carteBlanchePoints: 0 },
      ],
      tricksWon: {
        0: [c('SA-0', 'S', 'A'), c('HA-0', 'H', 'A'), c('DA-0', 'D', 'A'), c('CA-0', 'C', 'A'), c('S10-0', 'S', '10'), c('H10-0', 'H', '10')], // 60 brisque pts
        1: [],
      },
    });
    const result = finalizeScoring(state).result!;
    expect(result.winnerId).toBe(0);
    expect(result.roundedScores).toEqual({ 0: 1200, 1: 1100 }); // 1150+60=1210 -> 1200 vs 1150 -> 1100
  });

  it('counts brisques to rescue the trailing player from a rubicon when it would otherwise apply', () => {
    const state = makeScoringState({
      players: [
        { id: 0, hand: [], melds: [], score: 1600, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 950, carteBlanchePoints: 0 },
      ],
      tricksWon: {
        0: [],
        1: [c('SA-0', 'S', 'A'), c('DA-0', 'D', 'A'), c('D10-0', 'D', '10'), c('CA-0', 'C', 'A'), c('C10-0', 'C', '10')], // 50 brisque pts
      },
    });
    const result = finalizeScoring(state).result!;
    // 950 + 50 = 1000, rounds to 1000 -> no longer rubiconed
    expect(result.roundedScores[1]).toBe(1000);
    expect(result.rubiconed).toBe(false);
  });

  it('tie-break cascade: if brisques still leave the rounded totals tied, the higher raw score rounds up', () => {
    // Meld-only: both 1150 -> round to 1100, tied. Brisques: player0 +10, player1 +40.
    // Raw-with-brisques: 1160 vs 1190 -> both still round to 1100 -> still tied.
    // Cascade: player1 (higher raw) rounds UP to 1200 instead of down, guaranteeing a 100 gap.
    const state = makeScoringState({
      players: [
        { id: 0, hand: [], melds: [], score: 1150, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 1150, carteBlanchePoints: 0 },
      ],
      tricksWon: {
        0: [c('SA-0', 'S', 'A')], // 10 pts
        1: [c('HA-0', 'H', 'A'), c('DA-0', 'D', 'A'), c('CA-0', 'C', 'A'), c('S10-0', 'S', '10')], // 40 pts
      },
    });
    const result = finalizeScoring(state).result!;
    expect(result.winnerId).toBe(1);
    expect(result.roundedScores).toEqual({ 0: 1100, 1: 1200 });
  });

  it('throws only in the fully degenerate case where raw scores are identical even after brisques', () => {
    const state = makeScoringState({
      players: [
        { id: 0, hand: [], melds: [], score: 1150, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 1150, carteBlanchePoints: 0 },
      ],
      tricksWon: {
        0: [c('SA-0', 'S', 'A')], // 10 pts
        1: [c('HA-0', 'H', 'A')], // 10 pts, identical raw total to player 0
      },
    });
    expect(() => finalizeScoring(state)).toThrow(/exact tie/);
  });

  it('applies the rubicon bonus (1000 + sum of both rounded scores) when the loser stays under threshold', () => {
    const state = makeScoringState({
      players: [
        { id: 0, hand: [], melds: [], score: 1600, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 300, carteBlanchePoints: 0 },
      ],
    });
    const result = finalizeScoring(state).result!;
    expect(result.rubiconed).toBe(true);
    expect(result.winnerFinalScore).toBe(1000 + 1600 + 300);
  });

  it('throws if called outside the scoring phase', () => {
    const state = makeScoringState({ phase: 'main' });
    expect(() => finalizeScoring(state)).toThrow();
  });
});
