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

export interface Alternative {
  move: Move;
  /** The move's own display name — a card ("Q♠") or "Passing"/a meld kind label. */
  label: string;
  /** Card-agnostic reason template, e.g. "loses the trick outright" — deliberately
   * excludes the label so callers can group several alternatives sharing the identical
   * reason into one line instead of repeating it per card. */
  reason: string;
}

export interface TutorAdvice {
  move: Move;
  breakdown: EvaluationBreakdown;
  explanation: string;
  ranked: ScoredMove[];
  /** Why every OTHER legal move is worse than the recommendation — a tutor should teach
   * the reasoning, not just name a winner (architecture plan §5's "explain why, not just
   * what"). One entry per alternative, in ranked order. */
  alternatives: Alternative[];
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
const BREAKDOWN_KEYS: (keyof EvaluationWeights)[] = ['trickValue', 'meldProgress', 'brisqueRisk', 'informationGivenAway'];

/** Below this weighted-delta magnitude, a factor isn't worth naming as "the reason" —
 * matches the epsilon-scale tiebreaks evaluateMove itself uses, so genuine ties (not just
 * ones affected by a tiny rank tiebreak) read as ties rather than an overclaimed reason. */
const NEGLIGIBLE_DELTA = 0.5;

/** Which factor most separates two scored moves, and by how much (WEIGHTED, not raw —
 * a factor the tier barely cares about shouldn't be reported as "the reason" even if its
 * raw number happens to be large). */
function dominantFactor(a: ScoredMove, b: ScoredMove): { key: keyof EvaluationWeights; magnitude: number } {
  let dominantKey: keyof EvaluationWeights = 'trickValue';
  let dominantMagnitude = -Infinity;
  for (const key of BREAKDOWN_KEYS) {
    const magnitude = Math.abs((a.breakdown[key] - b.breakdown[key]) * TUTOR_WEIGHTS[key]);
    if (magnitude > dominantMagnitude) {
      dominantMagnitude = magnitude;
      dominantKey = key;
    }
  }
  return { key: dominantKey, magnitude: dominantMagnitude };
}

function explainTopMove(state: GameState, playerId: PlayerId, top: ScoredMove, runnerUp: ScoredMove | undefined): string {
  const { move, breakdown } = top;

  if (move.type === 'declareMeld') {
    const label = MELD_KIND_LABELS[move.meldKind];
    return `Declare ${label} — worth ${Math.round(breakdown.meldProgress)} points.`;
  }

  if (move.type === 'declareDix') {
    const exchanging = state.turnUpCard !== null;
    return exchanging
      ? `Declare the dix and exchange it for the turn-up card — worth ${Math.round(breakdown.meldProgress)} points.`
      : `Declare the dix — worth ${Math.round(breakdown.meldProgress)} points.`;
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

  const { key: dominantKey, magnitude: dominantMagnitude } = dominantFactor(top, runnerUp);

  if (dominantMagnitude < NEGLIGIBLE_DELTA) {
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
      // evaluateMove folds a tiny rank tiebreak (at most 8 * 0.01) into brisqueRisk so exact
      // ties break deterministically by rank instead of hand order — a card affected only by
      // that epsilon still has no REAL exposure and should read as safe, not risky.
      if (breakdown.brisqueRisk > -0.1) {
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

/**
 * Why a specific alternative is worse than the recommendation, split into the move's own
 * label and a card-agnostic reason template (e.g. label "K♣", reason "loses the trick
 * outright") rather than one fused sentence — so the UI can group several alternatives
 * that share the identical reason into one line instead of repeating it per card, which
 * matters once a hand has enough cards that many of them land on the same explanation.
 * Candidate-centric: the point is to teach why THIS move should be avoided, not to
 * re-explain why the top move is good. All legal moves in one decision share the same
 * shape (either declareMeld+pass together, or playCard alone — see getLegalMoves), so
 * top/candidate are never a playCard-vs-declareMeld mismatch in practice.
 */
function explainWhyWorse(state: GameState, playerId: PlayerId, top: ScoredMove, candidate: ScoredMove): { label: string; reason: string } {
  const { move, breakdown } = candidate;

  if (move.type === 'declareMeld') {
    const label = MELD_KIND_LABELS[move.meldKind];
    return {
      label,
      reason: `worth less — ${Math.round(breakdown.meldProgress)} points instead of ${Math.round(top.breakdown.meldProgress)}`,
    };
  }

  if (move.type === 'declareDix') {
    return {
      label: 'The dix',
      reason: `worth less — ${Math.round(breakdown.meldProgress)} points instead of ${Math.round(top.breakdown.meldProgress)}`,
    };
  }

  if (move.type === 'pass') {
    return { label: 'Passing', reason: `leaves ${Math.round(top.breakdown.meldProgress)} points undeclared` };
  }

  const hand = state.players[playerId].hand;
  const card = findCardById(hand, move.cardId);
  const label = cardLabel(card);

  const { key: dominantKey, magnitude: dominantMagnitude } = dominantFactor(top, candidate);

  if (dominantMagnitude < NEGLIGIBLE_DELTA) {
    return { label, reason: 'about as good as the recommended play — a close call either way' };
  }

  switch (dominantKey) {
    case 'trickValue': {
      if (breakdown.trickValue <= 0 && top.breakdown.trickValue > 0) {
        return { label, reason: 'loses the trick outright' };
      }
      if (top.breakdown.trickValue <= 0) {
        return { label, reason: 'gives up more than the recommended card' };
      }
      return { label, reason: 'wins too, but captures less value doing it' };
    }
    case 'meldProgress':
      return {
        label,
        reason:
          breakdown.meldProgress < top.breakdown.meldProgress
            ? 'costs more in meld potential'
            : 'makes less use of your meld options',
      };
    case 'brisqueRisk': {
      const isTrump = state.trumpSuit !== null && card.suit === state.trumpSuit;
      return { label, reason: isTrump ? 'gives up a trump card unnecessarily' : 'is riskier to lead — more likely to be captured' };
    }
    default:
      return { label, reason: 'gives away more information' };
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
  const alternatives: Alternative[] = ranked
    .slice(1)
    .map((candidate) => ({ move: candidate.move, ...explainWhyWorse(state, playerId, top!, candidate) }));

  return { move: top!.move, breakdown: top!.breakdown, explanation, ranked, alternatives };
}
