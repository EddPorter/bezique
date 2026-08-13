import {
  type EvaluationWeights,
  type RiskEstimator,
  evaluateMove,
  flatRiskEstimator,
  makeCardMemoryRiskEstimator,
} from './evaluation.js';
import { chooseEndgameLeadWithLookahead } from './endgameLookahead.js';
import type { Agent } from './types.js';
import type { GameState, Move, PlayerId } from '../engine/types.js';

/**
 * Architecture plan §5: "not separate code paths per tier, but one scoring
 * function with tunable weights." Every tier is this same class, configured
 * differently — never a different algorithm.
 */
export interface TierConfig {
  name: string;
  weights: EvaluationWeights;
  /** Probability [0-1] of picking a uniformly random legal move instead of the best-scored one. */
  randomness: number;
  /** Perfect memory of what's been played, used for brisque-exposure risk (Expert only). */
  cardMemory: boolean;
  /** Simulated 1-ply look-ahead for endgame leads (Expert only). */
  endgameLookahead: boolean;
  thinkingDelayMs: number;
}

export const NOVICE_TIER: TierConfig = {
  name: 'Novice',
  weights: { trickValue: 0.4, meldProgress: 0.3, brisqueRisk: 0.2, informationGivenAway: 0 },
  randomness: 0.5,
  cardMemory: false,
  endgameLookahead: false,
  thinkingDelayMs: 350,
};

export const CLUB_PLAYER_TIER: TierConfig = {
  name: 'Club Player',
  weights: { trickValue: 1, meldProgress: 1, brisqueRisk: 1, informationGivenAway: 0.2 },
  randomness: 0,
  cardMemory: false,
  endgameLookahead: false,
  thinkingDelayMs: 500,
};

export const EXPERT_TIER: TierConfig = {
  name: 'Expert',
  weights: { trickValue: 1.2, meldProgress: 1.3, brisqueRisk: 1.4, informationGivenAway: 0.5 },
  randomness: 0,
  cardMemory: true,
  endgameLookahead: true,
  thinkingDelayMs: 650,
};

export const AI_TIERS = [NOVICE_TIER, CLUB_PLAYER_TIER, EXPERT_TIER] as const;

export class WeightedAgent implements Agent {
  private readonly riskEstimator: RiskEstimator;

  constructor(
    private readonly playerId: PlayerId,
    private readonly tier: TierConfig,
    private readonly rng: () => number = Math.random,
  ) {
    this.riskEstimator = tier.cardMemory ? makeCardMemoryRiskEstimator() : flatRiskEstimator;
  }

  async chooseMove(state: GameState, legalMoves: Move[]): Promise<Move> {
    const move = this.pickMove(state, legalMoves);
    if (this.tier.thinkingDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.tier.thinkingDelayMs));
    }
    return move;
  }

  private pickMove(state: GameState, legalMoves: Move[]): Move {
    if (legalMoves.length === 1) return legalMoves[0]!;

    if (this.tier.randomness > 0 && this.rng() < this.tier.randomness) {
      return legalMoves[Math.floor(this.rng() * legalMoves.length)]!;
    }

    if (this.tier.endgameLookahead && state.phase === 'endgame' && state.stage === 'awaitingLead') {
      const candidates = legalMoves.filter((m): m is Extract<Move, { type: 'playCard' }> => m.type === 'playCard');
      if (candidates.length > 1) {
        return chooseEndgameLeadWithLookahead(state, this.playerId, candidates, this.tier.weights, this.riskEstimator);
      }
    }

    const scored = legalMoves.map((move) => ({
      move,
      score: evaluateMove(state, this.playerId, move, this.tier.weights, this.riskEstimator).total,
    }));
    return scored.sort((a, b) => b.score - a.score)[0]!.move;
  }
}
