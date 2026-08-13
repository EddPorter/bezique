import { applyMove, getLegalMoves } from '../engine/moves.js';
import type { Card, GameState, Move, PlayerId } from '../engine/types.js';
import { type EvaluationWeights, type RiskEstimator, evaluateMove, isBrisqueCard } from './evaluation.js';

const other = (id: PlayerId): PlayerId => (id === 0 ? 1 : 0);

function brisqueTotal(cards: Card[]): number {
  return cards.filter(isBrisqueCard).length;
}

/**
 * Expert-tier "shallow look-ahead on endgame forced-follow tricks" (architecture
 * plan §5): for each candidate lead, simulates the opponent's best response
 * (via the same evaluator, from their side) using the real, pure `applyMove`/
 * `getLegalMoves`, then scores the resulting trick by net brisques captured.
 * Endgame specifically, because that's where both players are constrained
 * enough (must follow suit, must win if able) for a 1-ply search to be both
 * tractable and meaningfully more accurate than the flat risk estimate that
 * `evaluateMove` uses for ordinary leads.
 */
export function chooseEndgameLeadWithLookahead(
  state: GameState,
  playerId: PlayerId,
  candidates: Extract<Move, { type: 'playCard' }>[],
  weights: EvaluationWeights,
  riskEstimator: RiskEstimator,
): Move {
  const opponentId = other(playerId);
  let best: { move: Move; score: number } | null = null;

  for (const candidate of candidates) {
    const afterLead = applyMove(state, candidate);
    const opponentLegalMoves = getLegalMoves(afterLead, opponentId);
    const opponentBest = opponentLegalMoves
      .map((m) => ({ move: m, score: evaluateMove(afterLead, opponentId, m, weights, riskEstimator).total }))
      .sort((a, b) => b.score - a.score)[0];

    const afterOpponent = opponentBest ? applyMove(afterLead, opponentBest.move) : afterLead;

    const myBrisqueGain = brisqueTotal(afterOpponent.tricksWon[playerId]) - brisqueTotal(state.tricksWon[playerId]);
    const opponentBrisqueGain =
      brisqueTotal(afterOpponent.tricksWon[opponentId]) - brisqueTotal(state.tricksWon[opponentId]);
    const score = myBrisqueGain - opponentBrisqueGain;

    if (!best || score > best.score) {
      best = { move: candidate, score };
    }
  }

  return best!.move;
}
