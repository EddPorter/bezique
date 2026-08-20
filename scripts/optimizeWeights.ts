import {
  applyMove,
  dealNewHand,
  finalizeScoring,
  getLegalMoves,
  makeRng,
  rubiconBezique,
  type Rng,
} from '../src/engine/index.js';
import { chineseBezique } from '../src/engine/chineseBezique.js';
import { EXPERT_TIER, WeightedAgent, type TierConfig } from '../src/agents/weightedAgent.js';
import type { EvaluationWeights } from '../src/agents/evaluation.js';
import type { Ruleset } from '../src/engine/types.js';

/**
 * Self-play genetic search for a better EXPERT_TIER.weights vector than the hand-tuned
 * one, by having candidate weight vectors play many full games (the real engine —
 * applyMove/getLegalMoves/finalizeScoring, same as WeightedAgent uses live) against the
 * current baseline and keeping whichever survive.
 *
 * This is a REPORTING tool only — nothing here ever writes back to weightedAgent.ts. A
 * human reviews the final printed result (and cross-checks it against
 * docs/ai-strategy-notes.md's sourced strategy reasoning) before manually updating
 * EXPERT_TIER.weights. Blindly trusting a raw optimization result would risk losing the
 * evaluator's groundedness in real, sourced Bezique strategy, and its explainability —
 * both deliberate project properties, not incidental.
 *
 * Dev-only: run via `npm run optimize:expert`, never as part of `npm test` (see
 * vitest.optimize.config.ts — this lives outside test/**, so the default `npx vitest run`
 * never touches it).
 */

// ---- tunable run parameters (env-overridable for a quick smoke run) ----
const MASTER_SEED = Number(process.env.OPTIMIZE_SEED ?? 42);
const QUICK = process.env.OPTIMIZE_QUICK === '1';
const RULESET: Ruleset = process.env.OPTIMIZE_RULESET === 'chinese' ? chineseBezique : rubiconBezique;
const RULESET_NAME = RULESET === chineseBezique ? 'Chinese Bezique' : 'Rubicon Bezique';

const WEIGHT_MIN = 0;
const WEIGHT_MAX = 3;
const MU = QUICK ? 4 : 5; // survivors kept each generation
const LAMBDA = QUICK ? 6 : 10; // fresh children evaluated each generation
const GENERATIONS = QUICK ? 4 : 8;
const INITIAL_SIGMA = 0.4;
const SIGMA_DECAY = 0.85;
const SIGMA_FLOOR = 0.05;
const TRAIN_HANDS = QUICK ? 30 : RULESET === chineseBezique ? 100 : 80;
const VALIDATION_HANDS = QUICK ? 40 : 200;
// A small nudge toward bigger score margins among candidates that are otherwise close on
// win rate — not a strict guarantee it can never outrank a 1-win difference (it can, in
// principle, for very lopsided margins), just a secondary signal on top of win rate.
const MARGIN_WEIGHT = 0.05;
const MARGIN_NORMALIZER = 500;

/**
 * evaluateMove's `total` is a linear combination of the four weights, and both
 * WeightedAgent.pickMove and chooseEndgameLeadWithLookahead (Expert's endgame path) only
 * ever take an argmax over that total — scaling every weight by the same positive
 * constant never changes which move wins the argmax (verified against both code paths
 * before implementing this). So the real search space is a RAY DIRECTION in 4-space, not
 * 4 independent numbers: trickValue is fixed at 1 as an anchor, and only the other three
 * weights are evolved relative to it. This also rules out the degenerate all-zero vector
 * for free, since trickValue can never be zero.
 */
type Genome = [meldProgress: number, brisqueRisk: number, informationGivenAway: number];

function toWeights(genome: Genome): EvaluationWeights {
  return { trickValue: 1, meldProgress: genome[0], brisqueRisk: genome[1], informationGivenAway: genome[2] };
}

function clamp(v: number): number {
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, v));
}

/** Box-Muller, driven by the same deterministic rng as the games themselves, so mutation
 * noise is reproducible from MASTER_SEED too, not just the card deals. */
function gaussian(rng: Rng): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function mutate(parent: Genome, sigma: number, rng: Rng): Genome {
  return [
    clamp(parent[0] + gaussian(rng) * sigma),
    clamp(parent[1] + gaussian(rng) * sigma),
    clamp(parent[2] + gaussian(rng) * sigma),
  ];
}

// Deliberately mirrors test/tierStrength.test.ts's playOneHand, duplicated rather than
// imported/shared — keeps this multi-minute dev tool fully decoupled from the fast,
// CI-critical test suite, which should be free to evolve independently of it.
async function playOneHand(tierA: TierConfig, tierB: TierConfig, seed: number) {
  const rng = makeRng(seed);
  const agentA = new WeightedAgent(0, { ...tierA, thinkingDelayMs: 0 }, rng);
  const agentB = new WeightedAgent(1, { ...tierB, thinkingDelayMs: 0 }, rng);
  let state = dealNewHand(RULESET, 1, rng);
  let guard = 0;
  while (state.phase !== 'complete' && guard < 20000) {
    guard++;
    if (state.phase === 'scoring') {
      state = finalizeScoring(state);
      continue;
    }
    const legal = getLegalMoves(state, state.turn);
    if (legal.length === 0) break;
    const agent = state.turn === 0 ? agentA : agentB;
    state = applyMove(state, await agent.chooseMove(state, legal));
  }
  return { scoreA: state.players[0].score, scoreB: state.players[1].score };
}

interface FitnessResult {
  fitness: number;
  winRate: number;
  wins: number;
  losses: number;
  ties: number;
  avgMargin: number;
}

/**
 * Scores a candidate genome by playing it against the CURRENT hand-tuned EXPERT_TIER over
 * `seeds`. `alternateSeats` (used only for the final held-out validation match) makes the
 * candidate play as both player 0 and player 1 across the match, cancelling out any
 * dealer/first-player advantage baked into a fixed seat assignment.
 */
async function evaluate(genome: Genome, seeds: readonly number[], alternateSeats: boolean): Promise<FitnessResult> {
  const candidate: TierConfig = { ...EXPERT_TIER, weights: toWeights(genome) };
  const baseline: TierConfig = { ...EXPERT_TIER };

  let wins = 0;
  let losses = 0;
  let ties = 0;
  let marginSum = 0;

  for (const seed of seeds) {
    const candidateIsA = !alternateSeats || seed % 2 === 0;
    const { scoreA, scoreB } = await playOneHand(
      candidateIsA ? candidate : baseline,
      candidateIsA ? baseline : candidate,
      seed,
    );
    const candidateScore = candidateIsA ? scoreA : scoreB;
    const baselineScore = candidateIsA ? scoreB : scoreA;
    marginSum += candidateScore - baselineScore;
    if (candidateScore > baselineScore) wins++;
    else if (baselineScore > candidateScore) losses++;
    else ties++;
  }

  const winRate = wins / seeds.length;
  const avgMargin = marginSum / seeds.length;
  const fitness = (wins - losses) / seeds.length + MARGIN_WEIGHT * (avgMargin / MARGIN_NORMALIZER);
  return { fitness, winRate, wins, losses, ties, avgMargin };
}

interface Individual {
  genome: Genome;
  result: FitnessResult;
}

function formatGenome(genome: Genome): string {
  return `meldProgress=${genome[0].toFixed(3)} brisqueRisk=${genome[1].toFixed(3)} informationGivenAway=${genome[2].toFixed(3)}`;
}

function logGeneration(gen: number, elites: Individual[], sigma: number): void {
  const best = elites[0]!;
  const meanFitness = elites.reduce((sum, e) => sum + e.result.fitness, 0) / elites.length;
  console.log(
    `[gen ${gen}] sigma=${sigma.toFixed(3)}  best fitness=${best.result.fitness.toFixed(4)} ` +
      `winRate=${(best.result.winRate * 100).toFixed(1)}% (${best.result.wins}W/${best.result.losses}L/${best.result.ties}T)  ` +
      `mean fitness=${meanFitness.toFixed(4)}`,
  );
  console.log(`         best genome: ${formatGenome(best.genome)}`);
}

function printFinalReport(best: Individual, validation: FitnessResult): void {
  const w = toWeights(best.genome);
  console.log(`\n=== Optimization complete (${RULESET_NAME}, seed ${MASTER_SEED}) ===`);
  console.log('Best-found weights (trickValue anchored to 1 — only ratios matter, scale is arbitrary):\n');
  console.log(
    `  weights: { trickValue: 1, meldProgress: ${w.meldProgress.toFixed(2)}, brisqueRisk: ${w.brisqueRisk.toFixed(2)}, informationGivenAway: ${w.informationGivenAway.toFixed(2)} }\n`,
  );
  console.log(
    `Held-out validation match vs. current EXPERT_TIER.weights (${VALIDATION_HANDS} hands, DIFFERENT seeds than training, seats alternated to cancel dealer bias):`,
  );
  console.log(
    `  candidate wins: ${validation.wins} (${(validation.winRate * 100).toFixed(1)}%)   ` +
      `baseline wins: ${validation.losses} (${((validation.losses / VALIDATION_HANDS) * 100).toFixed(1)}%)   ties: ${validation.ties}\n`,
  );
  console.log(
    '>>> This is a REPORT, not an auto-apply. Review this result — including checking it\n' +
      ">>> against docs/ai-strategy-notes.md's sourced strategy reasoning — before manually\n" +
      '>>> editing EXPERT_TIER.weights in src/agents/weightedAgent.ts. After changing it,\n' +
      '>>> re-run `npm test` (specifically test/tierStrength.test.ts) to confirm tier ordering\n' +
      '>>> still holds Novice < Club Player < Expert.',
  );
}

export async function runOptimization(): Promise<{ best: Individual; validation: FitnessResult }> {
  const gaRng = makeRng(MASTER_SEED);
  const trainSeeds = Array.from({ length: TRAIN_HANDS }, (_, i) => MASTER_SEED * 7919 + i + 1);
  const validationSeeds = Array.from({ length: VALIDATION_HANDS }, (_, i) => MASTER_SEED * 104729 + i + 1);

  console.log(
    `Starting optimization: ${RULESET_NAME}, seed=${MASTER_SEED}, MU=${MU} LAMBDA=${LAMBDA} generations=${GENERATIONS}, ` +
      `${TRAIN_HANDS} training hands/evaluation, ${VALIDATION_HANDS} validation hands.${QUICK ? ' (QUICK mode)' : ''}\n`,
  );

  const baselineGenome: Genome = [
    EXPERT_TIER.weights.meldProgress / EXPERT_TIER.weights.trickValue,
    EXPERT_TIER.weights.brisqueRisk / EXPERT_TIER.weights.trickValue,
    EXPERT_TIER.weights.informationGivenAway / EXPERT_TIER.weights.trickValue,
  ];

  let sigma = INITIAL_SIGMA;
  let elites: Individual[] = [];

  const initialGenomes: Genome[] = [baselineGenome];
  for (let i = 1; i < MU; i++) initialGenomes.push(mutate(baselineGenome, sigma, gaRng));
  for (const genome of initialGenomes) {
    elites.push({ genome, result: await evaluate(genome, trainSeeds, false) });
  }
  elites.sort((a, b) => b.result.fitness - a.result.fitness);
  logGeneration(0, elites, sigma);

  for (let gen = 1; gen <= GENERATIONS; gen++) {
    const children: Individual[] = [];
    for (let i = 0; i < LAMBDA; i++) {
      const parent = elites[Math.floor(gaRng() * elites.length)]!.genome;
      const genome = mutate(parent, sigma, gaRng);
      children.push({ genome, result: await evaluate(genome, trainSeeds, false) });
    }
    // Elite fitness is reused from previous generations, not re-evaluated — they were
    // already scored against the same fixed trainSeeds, so their fitness hasn't changed.
    const combined = [...elites, ...children];
    combined.sort((a, b) => b.result.fitness - a.result.fitness);
    elites = combined.slice(0, MU);
    sigma = Math.max(SIGMA_FLOOR, sigma * SIGMA_DECAY);
    logGeneration(gen, elites, sigma);
  }

  const best = elites[0]!;
  const validation = await evaluate(best.genome, validationSeeds, true);
  printFinalReport(best, validation);
  return { best, validation };
}
