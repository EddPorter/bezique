import { describe, it, expect } from 'vitest';
import { evaluateMove, makeCardMemoryRiskEstimator } from '../src/agents/evaluation.js';
import { applyMove, dealNewHand, finalizeScoring, getLegalMoves, makeRng } from '../src/engine/index.js';
import { rubiconBezique } from '../src/engine/ruleset.js';
import { chineseBezique } from '../src/engine/chineseBezique.js';
import { EXPERT_TIER } from '../src/agents/weightedAgent.js';
import type { Ruleset } from '../src/engine/types.js';

/**
 * A proactive audit, not a reproduction of a specific report: exhaustively evaluates
 * EVERY legal move at EVERY decision point across many full games (not just the move
 * actually chosen), checking invariants cheap enough to assert generically. The biggest
 * real meld in either ruleset is Quadruple Bezique at 4,500 — nothing evaluateMove
 * computes should ever exceed that in magnitude for a single card/move, since every
 * credit/cost function represents "value of the single most relevant meld," never a sum
 * across multiple. A violation here is exactly the shape of the two real bugs already
 * found this way (fourKings phantom cost, Bezique-family pair miscounting) — both were
 * a discounted/speculative value silently dwarfing every other term.
 */
const SANITY_CEILING = 4500;

function audit(ruleset: Ruleset, dealerId: 0 | 1, games: number) {
  const riskEstimator = makeCardMemoryRiskEstimator();
  const violations: string[] = [];

  for (let seed = 1; seed <= games; seed++) {
    const rng = makeRng(seed * 104729 + dealerId);
    let state = dealNewHand(ruleset, dealerId, rng);
    let guard = 0;
    while (state.phase !== 'complete' && guard < 20000) {
      guard++;
      if (state.phase === 'scoring') {
        state = finalizeScoring(state);
        continue;
      }
      const legal = getLegalMoves(state, state.turn);
      if (legal.length === 0) break;

      for (const move of legal) {
        const breakdown = evaluateMove(state, state.turn, move, EXPERT_TIER.weights, riskEstimator);
        for (const [key, value] of Object.entries(breakdown)) {
          if (key === 'total') continue;
          if (Math.abs(value) > SANITY_CEILING) {
            violations.push(
              `seed ${seed} move ${JSON.stringify(move)}: ${key}=${value.toFixed(1)} exceeds ceiling ${SANITY_CEILING}`,
            );
          }
        }
        // Declaring a meld always adds real points — never negative, never zero (it
        // wouldn't be a legal declareMeld option otherwise).
        if (move.type === 'declareMeld' && breakdown.meldProgress <= 0) {
          violations.push(`seed ${seed} move ${JSON.stringify(move)}: declareMeld meldProgress=${breakdown.meldProgress} should be > 0`);
        }
        // Passing never adds meld value — at best it's neutral (nothing declarable).
        if (move.type === 'pass' && breakdown.meldProgress > 0) {
          violations.push(`seed ${seed} move ${JSON.stringify(move)}: pass meldProgress=${breakdown.meldProgress} should be <= 0`);
        }
      }

      const move = legal[Math.floor(rng() * legal.length)]!;
      state = applyMove(state, move);
    }
  }
  return violations;
}

describe('evaluateMove: sanity audit across full games', () => {
  it('Rubicon Bezique: no breakdown term ever exceeds the biggest real meld value', () => {
    const violations = [...audit(rubiconBezique, 0, 150), ...audit(rubiconBezique, 1, 150)];
    if (violations.length > 0) console.log(violations.slice(0, 20).join('\n'));
    expect(violations).toHaveLength(0);
  });

  it('Chinese Bezique: no breakdown term ever exceeds the biggest real meld value', () => {
    const violations = [...audit(chineseBezique, 0, 100), ...audit(chineseBezique, 1, 100)];
    if (violations.length > 0) console.log(violations.slice(0, 20).join('\n'));
    expect(violations).toHaveLength(0);
  });
});
