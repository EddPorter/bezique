import { describe, expect, it } from 'vitest';
import { applyMove, dealNewHand, finalizeScoring, getLegalMoves, makeRng, rubiconBezique } from '../src/engine/index.js';
import { CLUB_PLAYER_TIER, EXPERT_TIER, NOVICE_TIER, WeightedAgent, type TierConfig } from '../src/agents/weightedAgent.js';

/**
 * Empirical check that the three AI tiers (architecture plan §5) are actually ordered by
 * strength, not just by their weight numbers looking plausible on paper. Plays full,
 * independent hands (Rubicon Bezique has no running multi-deal match — rules spec §5.1 —
 * so a single hand's final score IS the game outcome) with real WeightedAgent instances on
 * both sides, using the actual game loop (applyMove/getLegalMoves), same as the UI does.
 */
async function playOneHand(
  tierA: TierConfig,
  tierB: TierConfig,
  seed: number,
): Promise<{ scoreA: number; scoreB: number }> {
  const rng = makeRng(seed);
  const agentA = new WeightedAgent(0, { ...tierA, thinkingDelayMs: 0 }, rng);
  const agentB = new WeightedAgent(1, { ...tierB, thinkingDelayMs: 0 }, rng);
  let state = dealNewHand(rubiconBezique, 1, rng);
  let guard = 0;
  while (state.phase !== 'complete' && guard < 5000) {
    guard++;
    if (state.phase === 'scoring') {
      state = finalizeScoring(state);
      continue;
    }
    const legal = getLegalMoves(state, state.turn);
    if (legal.length === 0) break;
    const agent = state.turn === 0 ? agentA : agentB;
    const move = await agent.chooseMove(state, legal);
    state = applyMove(state, move);
  }
  return { scoreA: state.players[0].score, scoreB: state.players[1].score };
}

async function playMatch(tierA: TierConfig, tierB: TierConfig, hands: number) {
  let winsA = 0;
  let winsB = 0;
  for (let seed = 1; seed <= hands; seed++) {
    const { scoreA, scoreB } = await playOneHand(tierA, tierB, seed * 7919 + 1);
    if (scoreA > scoreB) winsA++;
    else if (scoreB > scoreA) winsB++;
    // ties (a void hand, Law 61) count toward neither
  }
  return { winsA, winsB };
}

describe('AI tier strength ordering (empirical)', () => {
  it('Club Player beats Novice more often than not', async () => {
    const { winsA, winsB } = await playMatch(NOVICE_TIER, CLUB_PLAYER_TIER, 40);
    expect(winsB).toBeGreaterThan(winsA);
  }, 30000);

  it('Expert beats Club Player more often than not', async () => {
    const { winsA, winsB } = await playMatch(CLUB_PLAYER_TIER, EXPERT_TIER, 40);
    expect(winsB).toBeGreaterThan(winsA);
  }, 30000);

  it('Expert beats Novice more often than not', async () => {
    const { winsA, winsB } = await playMatch(NOVICE_TIER, EXPERT_TIER, 40);
    expect(winsB).toBeGreaterThan(winsA);
  }, 30000);
});
