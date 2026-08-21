import type { Rng } from './deck.js';
import { finalizeDealScore } from './scoring.js';
import { dealNewHand } from './state.js';
import type { GameState, PlayerId, Ruleset } from './types.js';

const other = (id: PlayerId): PlayerId => (id === 0 ? 1 : 0);

/**
 * Classic Bezique's match layer (docs/classic-bezique-rules-spec.md §5): a running match
 * across MULTIPLE deals, first to `matchMode.targetScore` wins. `GameState` itself stays
 * scoped to exactly one deal, same as Rubicon/Chinese Bezique — this wraps a sequence of
 * them, carrying the cumulative score forward and alternating the deal.
 */
export interface MatchState {
  ruleset: Ruleset;
  /** Cumulative points from every COMPLETED deal only — the in-progress deal's own score
   * lives in `deal.players[id].score` until `finalizeMatchDeal` folds it in. */
  scores: Record<PlayerId, number>;
  dealerId: PlayerId;
  deal: GameState;
  /** Set once a player has reached the target with a strictly higher score than the other
   * (an exact tie at/above target is not stated by either source — see finalizeMatchDeal). */
  winnerId: PlayerId | null;
}

export function startMatch(ruleset: Ruleset, firstDealerId: PlayerId, rng: Rng): MatchState {
  if (ruleset.matchMode.kind !== 'cumulativeToTarget') {
    throw new Error(`startMatch only supports matchMode 'cumulativeToTarget', got '${ruleset.matchMode.kind}'`);
  }
  return {
    ruleset,
    scores: { 0: 0, 1: 0 },
    dealerId: firstDealerId,
    deal: dealNewHand(ruleset, firstDealerId, rng),
    winnerId: null,
  };
}

/**
 * Call once `match.deal.phase === 'scoring'`. Finalizes the deal's own score (brisques
 * included) and folds it into the running match totals, then checks for a match winner.
 * Not stated by either source: what happens if a deal ends with both players' cumulative
 * totals tied at or above the target. This treats that as unresolved — the match simply
 * continues to another deal — rather than inventing a tiebreak rule neither source gives.
 */
export function finalizeMatchDeal(match: MatchState): MatchState {
  const finalizedDeal = finalizeDealScore(match.deal);
  const scores: Record<PlayerId, number> = {
    0: match.scores[0] + finalizedDeal.players[0].score,
    1: match.scores[1] + finalizedDeal.players[1].score,
  };

  const matchMode = match.ruleset.matchMode;
  if (matchMode.kind !== 'cumulativeToTarget') {
    throw new Error(`finalizeMatchDeal only supports matchMode 'cumulativeToTarget', got '${matchMode.kind}'`);
  }
  const reachedTarget = scores[0] >= matchMode.targetScore || scores[1] >= matchMode.targetScore;
  const winnerId: PlayerId | null = reachedTarget && scores[0] !== scores[1] ? (scores[0] > scores[1] ? 0 : 1) : null;

  return { ...match, deal: finalizedDeal, scores, winnerId };
}

/** Deals the next hand of an ongoing match — dealer alternates (assumed, matching every
 * other variant; not directly stated for Classic Bezique). No-op once the match is decided. */
export function startNextMatchDeal(match: MatchState, rng: Rng): MatchState {
  if (match.winnerId !== null) return match;
  const nextDealerId = other(match.dealerId);
  return { ...match, dealerId: nextDealerId, deal: dealNewHand(match.ruleset, nextDealerId, rng) };
}
