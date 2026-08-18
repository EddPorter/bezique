import { describe, expect, it } from 'vitest';
import { applyMove, dealNewHand, finalizeScoring, getLegalMoves, makeRng } from '../src/engine/index.js';
import { chineseBezique } from '../src/engine/chineseBezique.js';
import { CLUB_PLAYER_TIER, EXPERT_TIER, NOVICE_TIER, WeightedAgent, type TierConfig } from '../src/agents/weightedAgent.js';
import { getTutorAdvice } from '../src/agents/tutor.js';

/**
 * The engine-level tests in chineseBezique.test.ts cover rules correctness with uniform
 * random legal moves. This file separately checks the AI agents and tutor specifically —
 * they share the evaluator with Rubicon Bezique, but Chinese Bezique's much bigger meld
 * values (trump quartets up to 1,000) and much longer hands (~192 cards vs ~128, ~96 tricks
 * vs ~55) are exactly the kind of thing that could silently distort a weighted evaluator
 * tuned against the smaller numbers.
 */
async function playOneHand(tierA: TierConfig, tierB: TierConfig, seed: number, askTutor: boolean) {
  const rng = makeRng(seed);
  const agentA = new WeightedAgent(0, { ...tierA, thinkingDelayMs: 0 }, rng);
  const agentB = new WeightedAgent(1, { ...tierB, thinkingDelayMs: 0 }, rng);
  let state = dealNewHand(chineseBezique, 1, rng);
  let guard = 0;
  let trumpQuartetsDeclared = 0;
  while (state.phase !== 'complete' && guard < 20000) {
    guard++;
    if (state.phase === 'scoring') {
      state = finalizeScoring(state);
      continue;
    }
    const legal = getLegalMoves(state, state.turn);
    if (legal.length === 0) break;

    if (askTutor && state.turn === 0) {
      // Never chooses a move itself (architecture plan §5) — just must not throw, and must
      // return a legal move as its top pick, for every decision shape this ruleset produces.
      const advice = getTutorAdvice(state, 0, legal);
      expect(advice).not.toBeNull();
      expect(legal).toContainEqual(advice!.move);
    }

    const agent = state.turn === 0 ? agentA : agentB;
    const move = await agent.chooseMove(state, legal);
    if (move.type === 'declareMeld' && move.meldKind.startsWith('fourTrump')) trumpQuartetsDeclared++;
    state = applyMove(state, move);
  }
  return { scoreA: state.players[0].score, scoreB: state.players[1].score, trumpQuartetsDeclared, guard };
}

async function playMatch(tierA: TierConfig, tierB: TierConfig, hands: number) {
  let winsA = 0;
  let winsB = 0;
  let trumpQuartetsDeclared = 0;
  for (let seed = 1; seed <= hands; seed++) {
    const r = await playOneHand(tierA, tierB, seed * 7919 + 1, false);
    if (r.scoreA > r.scoreB) winsA++;
    else if (r.scoreB > r.scoreA) winsB++;
    trumpQuartetsDeclared += r.trumpQuartetsDeclared;
  }
  return { winsA, winsB, trumpQuartetsDeclared };
}

describe('Chinese Bezique: AI tier strength ordering (empirical)', () => {
  // Hands run much longer here than Rubicon Bezique's tierStrength.test.ts (~96 tricks vs
  // ~55), which adds more noise per hand — a 30-hand sample gave Club Player a misleading
  // 17-13 "win" over Expert during initial testing; 120 hands correctly resolved to Expert
  // ahead. Using bigger samples here than the Rubicon Bezique version for that reason.
  it('Expert beats Club Player more often than not', async () => {
    const { winsA, winsB } = await playMatch(CLUB_PLAYER_TIER, EXPERT_TIER, 120);
    expect(winsB).toBeGreaterThan(winsA);
  }, 60000);

  it('Expert beats Novice more often than not', async () => {
    const { winsA, winsB } = await playMatch(NOVICE_TIER, EXPERT_TIER, 60);
    expect(winsB).toBeGreaterThan(winsA);
  }, 60000);

  it('AI agents actually declare trump quartets across enough games (sanity check, not just theoretically legal)', async () => {
    const { trumpQuartetsDeclared } = await playMatch(NOVICE_TIER, EXPERT_TIER, 30);
    expect(trumpQuartetsDeclared).toBeGreaterThan(0);
  }, 60000);
});

describe('Chinese Bezique: tutor never throws', () => {
  it('produces a legal top-move recommendation across every decision in many full games', async () => {
    for (let seed = 1; seed <= 15; seed++) {
      await playOneHand(NOVICE_TIER, EXPERT_TIER, seed * 104729 + 1, true);
    }
  }, 60000);
});
