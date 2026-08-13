import { SUIT_SYMBOL } from '../engine/cards.js';
import { MELD_KIND_LABELS } from '../engine/meldLabels.js';
import type { Card, GameState, Move, PlayerId } from '../engine/types.js';
import {
  type EvaluationBreakdown,
  type EvaluationWeights,
  evaluateMove,
  isBrisqueCard,
  makeCardMemoryRiskEstimator,
} from './evaluation.js';
import { EXPERT_TIER } from './weightedAgent.js';

/**
 * The tutor (architecture plan §5) is not a move-chooser — it's a read-only
 * advisor that runs the SAME evaluation function an AI agent would use, ranks
 * the human's legal moves by it, and surfaces the top choice with a plain-
 * English reason drawn from the structured breakdown. It reasons like the
 * strongest tier (Expert's weights and card-memory risk estimator), since
 * "what should I do" advice should reflect the best available judgement, not
 * a deliberately weaker one.
 */
const TUTOR_WEIGHTS: EvaluationWeights = EXPERT_TIER.weights;

export interface ScoredMove {
  move: Move;
  breakdown: EvaluationBreakdown;
}

export interface TutorAdvice {
  move: Move;
  breakdown: EvaluationBreakdown;
  explanation: string;
  ranked: ScoredMove[];
}

function cardLabel(card: Card): string {
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}

function findCardById(hand: Card[], id: string): Card {
  const card = hand.find((c) => c.id === id);
  if (!card) throw new Error(`Card ${id} not in hand`);
  return card;
}

/**
 * Turns the factor that most separates the top move from the runner-up into a
 * concrete, plain-English reason — e.g. "wins the trick and captures a
 * brisque" rather than a bare score. Compares WEIGHTED deltas (how much each
 * factor actually swayed the total), not raw ones, since a factor the tier
 * barely cares about shouldn't be reported as "the reason" even if its raw
 * number happens to be large.
 */
function explainTopMove(state: GameState, playerId: PlayerId, top: ScoredMove, runnerUp: ScoredMove | undefined): string {
  const { move, breakdown } = top;

  if (move.type === 'declareMeld') {
    const label = MELD_KIND_LABELS[move.meldKind];
    return `Declare ${label} — worth ${Math.round(breakdown.meldProgress)} points.`;
  }

  if (move.type === 'pass') {
    return 'Nothing worth declaring here — pass and keep your hand intact.';
  }

  const hand = state.players[playerId].hand;
  const card = findCardById(hand, move.cardId);
  const label = cardLabel(card);

  if (!runnerUp) {
    return `${label} is your only legal card.`;
  }

  const keys: (keyof EvaluationWeights)[] = ['trickValue', 'meldProgress', 'brisqueRisk', 'informationGivenAway'];
  let dominantKey: keyof EvaluationWeights = 'trickValue';
  let dominantMagnitude = -Infinity;
  for (const key of keys) {
    const magnitude = Math.abs((top.breakdown[key] - runnerUp.breakdown[key]) * TUTOR_WEIGHTS[key]);
    if (magnitude > dominantMagnitude) {
      dominantMagnitude = magnitude;
      dominantKey = key;
    }
  }

  if (dominantMagnitude < 0.5) {
    return `${label} is about as good as your other options here.`;
  }

  switch (dominantKey) {
    case 'trickValue': {
      if (breakdown.trickValue > 0) {
        const leadCard = state.currentTrick.leadCard;
        const capturesBrisque = leadCard !== null && (isBrisqueCard(leadCard) || isBrisqueCard(card));
        return capturesBrisque ? `${label} wins the trick and captures a brisque.` : `${label} wins the trick.`;
      }
      return `${label} gives up the least here — every other card loses more.`;
    }
    case 'meldProgress':
      return breakdown.meldProgress < 0
        ? `${label} costs you the least in meld potential.`
        : `${label} keeps your meld options open.`;
    case 'brisqueRisk': {
      if (breakdown.brisqueRisk >= 0) {
        return `${label} is safe to lead — nothing threatens it, and it costs you no trump.`;
      }
      const isTrump = state.trumpSuit !== null && card.suit === state.trumpSuit;
      if (isTrump) {
        return `${label} costs you a trump card, but every other lead costs more.`;
      }
      return `${label} is risky, but every other lead risks more.`;
    }
    default:
      return `${label} gives away the least information.`;
  }
}

export function getTutorAdvice(state: GameState, playerId: PlayerId, legalMoves: Move[]): TutorAdvice | null {
  if (legalMoves.length === 0) return null;

  const riskEstimator = makeCardMemoryRiskEstimator();
  const ranked: ScoredMove[] = legalMoves
    .map((move) => ({ move, breakdown: evaluateMove(state, playerId, move, TUTOR_WEIGHTS, riskEstimator) }))
    .sort((a, b) => b.breakdown.total - a.breakdown.total);

  const [top, runnerUp] = ranked;
  const explanation = explainTopMove(state, playerId, top!, runnerUp);

  return { move: top!.move, breakdown: top!.breakdown, explanation, ranked };
}
