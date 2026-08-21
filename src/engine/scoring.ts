import type { Card, GameState, HandResult, Player, PlayerId } from './types.js';

const other = (id: PlayerId): PlayerId => (id === 0 ? 1 : 0);

function brisqueScore(tricks: Card[], brisqueValue: number): number {
  return tricks.filter((c) => c.rank === 'A' || c.rank === '10').length * brisqueValue;
}

function roundDown(score: number, roundTo: number): number {
  return Math.floor(score / roundTo) * roundTo;
}

function meldOnlyRoundedTotals(state: GameState, roundTo: number): Record<PlayerId, number> {
  const totals = {} as Record<PlayerId, number>;
  for (const id of [0, 1] as PlayerId[]) {
    totals[id] = roundDown(state.players[id].score, roundTo);
  }
  return totals;
}

function withBrisquesRoundedTotals(state: GameState, roundTo: number): Record<PlayerId, number> {
  const totals = {} as Record<PlayerId, number>;
  for (const id of [0, 1] as PlayerId[]) {
    const raw = state.players[id].score + brisqueScore(state.tricksWon[id], state.ruleset.brisqueValue);
    totals[id] = roundDown(raw, roundTo);
  }
  return totals;
}

/**
 * Rules spec §5, verified against the 1887 Portland Club code (Laws 56-61):
 * round meld totals down to the nearest 100; brisques are only counted in to
 * break a near-tie or to rescue a trailing player from rubicon (unless the
 * ruleset says brisques always count — Classic Bezique, docs/classic-bezique-
 * rules-spec.md §5); a genuine tie that survives even with brisques counted
 * voids the hand entirely (Law 61) rather than forcing a winner.
 *
 * Only valid for `matchMode.kind === 'singleHandComplete'` rulesets (Rubicon/
 * Chinese Bezique) — a `cumulativeToTarget` ruleset's deals don't produce a
 * winner/rubicon outcome on their own, only a score to add to the match total.
 */
export function finalizeScoring(state: GameState): GameState {
  if (state.phase !== 'scoring') {
    throw new Error(`finalizeScoring called outside the scoring phase (phase=${state.phase})`);
  }
  const matchMode = state.ruleset.matchMode;
  if (matchMode.kind !== 'singleHandComplete') {
    throw new Error(`finalizeScoring only supports matchMode 'singleHandComplete', got '${matchMode.kind}'`);
  }

  const meldOnly = meldOnlyRoundedTotals(state, matchMode.roundTo);
  const meldOnlyLeaderId: PlayerId = meldOnly[0] >= meldOnly[1] ? 0 : 1;
  const meldOnlyLoserId = other(meldOnlyLeaderId);
  const meldOnlyTie = meldOnly[0] === meldOnly[1];
  const meldOnlyWouldRubicon = meldOnly[meldOnlyLoserId] < matchMode.rubiconThreshold;

  const needsBrisques = state.ruleset.brisquesAlwaysCount || meldOnlyTie || meldOnlyWouldRubicon;
  const roundedScores = needsBrisques ? withBrisquesRoundedTotals(state, matchMode.roundTo) : meldOnly;

  if (roundedScores[0] === roundedScores[1]) {
    // Law 61: a genuine tie even after brisques makes the hand null and void.
    const result: HandResult = {
      void: true,
      winnerId: null,
      roundedScores,
      rubiconed: false,
      winnerFinalScore: null,
    };
    return { ...state, phase: 'complete', result };
  }

  const winnerId: PlayerId = roundedScores[0] > roundedScores[1] ? 0 : 1;
  const loserId = other(winnerId);
  const rubiconed = roundedScores[loserId] < matchMode.rubiconThreshold;

  let winnerFinalScore: number;
  if (rubiconed) {
    // Law 59: a rubiconed loser's own score under 100 counts as 100 for this addition.
    const loserContribution = Math.max(roundedScores[loserId], 100);
    winnerFinalScore = roundedScores[winnerId] + loserContribution + matchMode.rubiconBonus;
  } else {
    // Law 57: minimum recorded difference is 100 (always true once rounded totals differ at all).
    const diff = Math.max(roundedScores[winnerId] - roundedScores[loserId], 100);
    winnerFinalScore = matchMode.gameBonus + diff;
  }

  const result: HandResult = {
    void: false,
    winnerId,
    roundedScores,
    rubiconed,
    winnerFinalScore,
  };

  return { ...state, phase: 'complete', result };
}

/**
 * Classic Bezique's per-deal scoring (docs/classic-bezique-rules-spec.md §5) — deliberately
 * NOT `finalizeScoring`'s winner/rubicon/void logic, which only makes sense when a single
 * deal decides the whole game. A `cumulativeToTarget` deal has no winner of its own: it just
 * folds brisques (unconditional here — brisquesAlwaysCount) into each player's own score, so
 * `state.players[id].score` ends up as that player's complete contribution for THIS deal,
 * ready for the match layer (src/engine/match.ts) to add to their running match total. No
 * rounding — Classic Bezique's sources describe no such step, unlike Rubicon/Chinese.
 */
export function finalizeDealScore(state: GameState): GameState {
  if (state.phase !== 'scoring') {
    throw new Error(`finalizeDealScore called outside the scoring phase (phase=${state.phase})`);
  }
  if (state.ruleset.matchMode.kind !== 'cumulativeToTarget') {
    throw new Error(`finalizeDealScore only supports matchMode 'cumulativeToTarget', got '${state.ruleset.matchMode.kind}'`);
  }

  const players = state.players.map((player): Player => ({
    ...player,
    score: player.score + brisqueScore(state.tricksWon[player.id], state.ruleset.brisqueValue),
  })) as [Player, Player];

  return { ...state, players, phase: 'complete' };
}
