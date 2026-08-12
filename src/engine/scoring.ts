import type { Card, GameState, HandResult, PlayerId } from './types.js';

const other = (id: PlayerId): PlayerId => (id === 0 ? 1 : 0);

function brisqueScore(tricks: Card[], brisqueValue: number): number {
  return tricks.filter((c) => c.rank === 'A' || c.rank === '10').length * brisqueValue;
}

function roundDown(score: number, roundTo: number): number {
  return Math.floor(score / roundTo) * roundTo;
}

function rawTotalsFor(state: GameState, includeBrisques: boolean): Record<PlayerId, number> {
  const totals = {} as Record<PlayerId, number>;
  for (const id of [0, 1] as PlayerId[]) {
    const player = state.players[id];
    totals[id] = includeBrisques
      ? player.score + brisqueScore(state.tricksWon[id], state.ruleset.brisqueValue)
      : player.score;
  }
  return totals;
}

function roundAllDown(raw: Record<PlayerId, number>, roundTo: number): Record<PlayerId, number> {
  return { 0: roundDown(raw[0], roundTo), 1: roundDown(raw[1], roundTo) };
}

/**
 * Rules spec §5: round down to the nearest 100, higher rounded total wins.
 * Brisques (§5.4) are only counted in when the meld-only picture is a tie, or
 * when the trailing player would otherwise be rubiconed — melds dominate
 * normal scoring. Tie-break cascade per whiteknucklecards.com (§7): if
 * rounding down still ties even after brisques, the player with the higher
 * pre-rounding total rounds UP instead of down, guaranteeing a 100-point gap.
 */
export function finalizeScoring(state: GameState): GameState {
  if (state.phase !== 'scoring') {
    throw new Error(`finalizeScoring called outside the scoring phase (phase=${state.phase})`);
  }

  const meldOnlyRaw = rawTotalsFor(state, false);
  const meldOnly = roundAllDown(meldOnlyRaw, state.ruleset.roundTo);
  const meldOnlyLeaderId: PlayerId = meldOnly[0] >= meldOnly[1] ? 0 : 1;
  const meldOnlyLoserId = other(meldOnlyLeaderId);
  const meldOnlyTie = meldOnly[0] === meldOnly[1];
  const meldOnlyWouldRubicon = meldOnly[meldOnlyLoserId] < state.ruleset.rubiconThreshold;

  const needsBrisques = meldOnlyTie || meldOnlyWouldRubicon;
  const rawScores = needsBrisques ? rawTotalsFor(state, true) : meldOnlyRaw;
  let roundedScores = needsBrisques ? roundAllDown(rawScores, state.ruleset.roundTo) : meldOnly;

  if (roundedScores[0] === roundedScores[1]) {
    if (rawScores[0] === rawScores[1]) {
      throw new Error(
        'Hand ended in an exact tie down to the raw score, even after counting brisques — not addressed by any sourced ruleset',
      );
    }
    const higherId: PlayerId = rawScores[0] > rawScores[1] ? 0 : 1;
    roundedScores = { ...roundedScores, [higherId]: roundedScores[higherId] + state.ruleset.roundTo };
  }

  const winnerId: PlayerId = roundedScores[0] > roundedScores[1] ? 0 : 1;
  const loserId = other(winnerId);
  const rubiconed = roundedScores[loserId] < state.ruleset.rubiconThreshold;

  const winnerFinalScore = rubiconed
    ? state.ruleset.rubiconThreshold + roundedScores[winnerId] + roundedScores[loserId]
    : state.ruleset.gameBonus + (roundedScores[winnerId] - roundedScores[loserId]);

  const result: HandResult = {
    winnerId,
    roundedScores,
    rubiconed,
    bonus: winnerFinalScore,
    winnerFinalScore,
  };

  return { ...state, phase: 'complete', result };
}
