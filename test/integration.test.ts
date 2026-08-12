import { describe, expect, it } from 'vitest';
import { makeRng, type Rng } from '../src/engine/deck.js';
import { applyMove, getLegalMoves } from '../src/engine/moves.js';
import { rubiconBezique } from '../src/engine/ruleset.js';
import { finalizeScoring } from '../src/engine/scoring.js';
import { dealNewHand } from '../src/engine/state.js';
import type { GameState } from '../src/engine/types.js';

/**
 * Plays a full game picking a pseudo-random legal move each turn (seeded, reproducible).
 * "Always take the first legal move" turned out to be too degenerate for a smoke test —
 * it tends to always decline melds, producing symmetric ties that mask real bugs.
 */
function playToScoringPhase(seed: number): GameState {
  const rng: Rng = makeRng(seed);
  let state = dealNewHand(rubiconBezique, 0, rng);
  let iterations = 0;
  const maxIterations = 10_000;

  while (state.phase !== 'scoring' && state.phase !== 'complete') {
    iterations++;
    if (iterations > maxIterations) {
      throw new Error('Game did not terminate — likely an infinite loop in the state machine');
    }
    const moves = getLegalMoves(state, state.turn);
    if (moves.length === 0) {
      throw new Error(`No legal moves for player ${state.turn} in phase=${state.phase} stage=${state.stage}`);
    }
    const pick = moves[Math.floor(rng() * moves.length)]!;
    state = applyMove(state, pick);
  }
  return state;
}

describe('full game playthrough (integration smoke test)', () => {
  it('runs deal -> main -> endgame -> scoring without throwing, across many seeds', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const finalState = playToScoringPhase(seed);
      expect(finalState.phase).toBe('scoring');
      expect(finalState.players[0].hand).toHaveLength(0);
      expect(finalState.players[1].hand).toHaveLength(0);
      expect(finalState.deck).toHaveLength(0);
    }
  });

  it('produces a valid, non-negative result whenever the hand is not an exact tie', () => {
    let scored = 0;
    let tied = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const preScoring = playToScoringPhase(seed);
      try {
        const result = finalizeScoring(preScoring).result!;
        scored++;
        expect([0, 1]).toContain(result.winnerId);
        expect(result.roundedScores[result.winnerId]).toBeGreaterThanOrEqual(
          result.roundedScores[result.winnerId === 0 ? 1 : 0],
        );
        expect(result.winnerFinalScore).toBeGreaterThan(0);
      } catch (err) {
        // Exact ties (even after brisques) are a known open question in rules spec §7 —
        // not implemented, and rare enough with real (non-random) play not to matter yet.
        expect((err as Error).message).toMatch(/exact tie/);
        tied++;
      }
    }
    expect(scored).toBeGreaterThan(0);
  });

  it('every card played across the game is accounted for exactly once', () => {
    const finalState = playToScoringPhase(42);
    const allCardIds = [
      ...finalState.tricksWon[0].map((c) => c.id),
      ...finalState.tricksWon[1].map((c) => c.id),
    ];
    expect(allCardIds).toHaveLength(128);
    expect(new Set(allCardIds).size).toBe(128);
  });
});
