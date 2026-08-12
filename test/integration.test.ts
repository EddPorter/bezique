import { describe, expect, it } from 'vitest';
import { makeRng, type Rng } from '../src/engine/deck.js';
import { applyMove, getLegalMoves } from '../src/engine/moves.js';
import { rubiconBezique } from '../src/engine/ruleset.js';
import { finalizeScoring } from '../src/engine/scoring.js';
import { dealNewHand } from '../src/engine/state.js';
import type { GameState } from '../src/engine/types.js';

/** Plays a full game picking a pseudo-random legal move each turn (seeded, reproducible). */
function playFullGame(seed: number): GameState {
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
  return finalizeScoring(state);
}

describe('full game playthrough (integration smoke test)', () => {
  it('runs deal -> main -> endgame -> scoring -> complete without throwing, across many seeds', () => {
    // Per Law 61 an exact tie even after brisques voids the hand (see scoring.ts) rather
    // than forcing a winner — a real, valid outcome, not something to treat as a failure.
    for (let seed = 1; seed <= 20; seed++) {
      const finalState = playFullGame(seed);
      expect(finalState.phase).toBe('complete');
      expect(finalState.players[0].hand).toHaveLength(0);
      expect(finalState.players[1].hand).toHaveLength(0);
      expect(finalState.deck).toHaveLength(0);

      const result = finalState.result!;
      if (result.void) {
        expect(result.roundedScores[0]).toBe(result.roundedScores[1]);
        continue;
      }
      expect([0, 1]).toContain(result.winnerId);
      const loserId = result.winnerId === 0 ? 1 : 0;
      expect(result.roundedScores[result.winnerId]).toBeGreaterThan(result.roundedScores[loserId]);
      expect(result.winnerFinalScore).toBeGreaterThan(0);
    }
  });

  it('every card played across the game is accounted for exactly once', () => {
    const finalState = playFullGame(42);
    const allCardIds = [
      ...finalState.tricksWon[0].map((c) => c.id),
      ...finalState.tricksWon[1].map((c) => c.id),
    ];
    expect(allCardIds).toHaveLength(128);
    expect(new Set(allCardIds).size).toBe(128);
  });
});
