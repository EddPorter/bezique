import type { Card, GameState, HandResult, PlayerId } from './types.js';

const other = (id: PlayerId): PlayerId => (id === 0 ? 1 : 0);

function brisqueScore(tricks: Card[], brisqueValue: number): number {
  return tricks.filter((c) => c.rank === 'A' || c.rank === '10').length * brisqueValue;
}

function roundDown(score: number, roundTo: number): number {
  return Math.floor(score / roundTo) * roundTo;
}

function meldOnlyRoundedTotals(state: GameState): Record<PlayerId, number> {
  const totals = {} as Record<PlayerId, number>;
  for (const id of [0, 1] as PlayerId[]) {
    totals[id] = roundDown(state.players[id].score, state.ruleset.roundTo);
  }
  return totals;
}

function withBrisquesRoundedTotals(state: GameState): Record<PlayerId, number> {
  const totals = {} as Record<PlayerId, number>;
  for (const id of [0, 1] as PlayerId[]) {
    const raw = state.players[id].score + brisqueScore(state.tricksWon[id], state.ruleset.brisqueValue);
    totals[id] = roundDown(raw, state.ruleset.roundTo);
  }
  return totals;
}

/**
 * Rules spec §5, verified against the 1887 Portland Club code (Laws 56-61):
 * round meld totals down to the nearest 100; brisques are only counted in to
 * break a near-tie or to rescue a trailing player from rubicon; a genuine tie
 * that survives even with brisques counted voids the hand entirely (Law 61)
 * rather than forcing a winner.
 */
export function finalizeScoring(state: GameState): GameState {
  if (state.phase !== 'scoring') {
    throw new Error(`finalizeScoring called outside the scoring phase (phase=${state.phase})`);
  }

  const meldOnly = meldOnlyRoundedTotals(state);
  const meldOnlyLeaderId: PlayerId = meldOnly[0] >= meldOnly[1] ? 0 : 1;
  const meldOnlyLoserId = other(meldOnlyLeaderId);
  const meldOnlyTie = meldOnly[0] === meldOnly[1];
  const meldOnlyWouldRubicon = meldOnly[meldOnlyLoserId] < state.ruleset.rubiconThreshold;

  const needsBrisques = meldOnlyTie || meldOnlyWouldRubicon;
  const roundedScores = needsBrisques ? withBrisquesRoundedTotals(state) : meldOnly;

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
  const rubiconed = roundedScores[loserId] < state.ruleset.rubiconThreshold;

  let winnerFinalScore: number;
  if (rubiconed) {
    // Law 59: a rubiconed loser's own score under 100 counts as 100 for this addition.
    const loserContribution = Math.max(roundedScores[loserId], 100);
    winnerFinalScore = roundedScores[winnerId] + loserContribution + state.ruleset.rubiconBonus;
  } else {
    // Law 57: minimum recorded difference is 100 (always true once rounded totals differ at all).
    const diff = Math.max(roundedScores[winnerId] - roundedScores[loserId], 100);
    winnerFinalScore = state.ruleset.gameBonus + diff;
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
