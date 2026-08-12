import type { Card, GameState, HandResult, PlayerId } from './types.js';

const other = (id: PlayerId): PlayerId => (id === 0 ? 1 : 0);

function brisqueScore(tricks: Card[], brisqueValue: number): number {
  return tricks.filter((c) => c.rank === 'A' || c.rank === '10').length * brisqueValue;
}

function roundDown(score: number, roundTo: number): number {
  return Math.floor(score / roundTo) * roundTo;
}

function totalsFor(
  state: GameState,
  includeBrisques: boolean,
): Record<PlayerId, number> {
  const totals = {} as Record<PlayerId, number>;
  for (const id of [0, 1] as PlayerId[]) {
    const player = state.players[id];
    const raw = includeBrisques ? player.score + brisqueScore(state.tricksWon[id], state.ruleset.brisqueValue) : player.score;
    totals[id] = roundDown(raw, state.ruleset.roundTo);
  }
  return totals;
}

/**
 * Rules spec §5: round down to the nearest 100, higher rounded total wins.
 * Brisques (spec §5.4) are only counted in when the meld-only picture is a
 * tie, or when the trailing player would otherwise be rubiconed — melds
 * dominate normal scoring.
 */
export function finalizeScoring(state: GameState): GameState {
  if (state.phase !== 'scoring') {
    throw new Error(`finalizeScoring called outside the scoring phase (phase=${state.phase})`);
  }

  const meldOnly = totalsFor(state, false);
  const meldOnlyLeaderId: PlayerId = meldOnly[0] >= meldOnly[1] ? 0 : 1;
  const meldOnlyLoserId = other(meldOnlyLeaderId);
  const meldOnlyTie = meldOnly[0] === meldOnly[1];
  const meldOnlyWouldRubicon = meldOnly[meldOnlyLoserId] < state.ruleset.rubiconThreshold;

  const roundedScores = meldOnlyTie || meldOnlyWouldRubicon ? totalsFor(state, true) : meldOnly;

  if (roundedScores[0] === roundedScores[1]) {
    throw new Error('Hand ended in an exact tie even after counting brisques — unresolved by the current ruleset');
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
