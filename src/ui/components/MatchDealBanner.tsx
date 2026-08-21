import type { MatchState } from '../../engine/match.js';
import { AI_ID, HUMAN_ID } from '../playerIds.js';

/**
 * Classic Bezique's between-deals transition screen (docs/classic-bezique-rules-spec.md §5)
 * — the counterpart to ResultBanner for `cumulativeToTarget` matches. A single deal has no
 * winner of its own here (unlike Rubicon/Chinese Bezique's ResultBanner): it just reports
 * this deal's score and the new running match totals, then either offers "Next Deal" (match
 * still open) or announces the match winner and offers "New Match".
 */
export function MatchDealBanner({ match, onNextDeal, onNewMatch }: {
  match: MatchState;
  onNextDeal: () => void;
  onNewMatch: () => void;
}) {
  const dealScore = match.deal.players;
  const matchMode = match.ruleset.matchMode;
  if (matchMode.kind !== 'cumulativeToTarget') return null;

  return (
    <div className="result-banner">
      <p>
        Deal complete — you scored {dealScore[HUMAN_ID].score}, opponent scored {dealScore[AI_ID].score}.
      </p>
      <p>
        Match total: you {match.scores[HUMAN_ID]}, opponent {match.scores[AI_ID]} (first to {matchMode.targetScore}).
      </p>
      {match.winnerId === null ? (
        <button type="button" onClick={onNextDeal}>
          Next deal
        </button>
      ) : (
        <>
          <p>
            <strong>{match.winnerId === HUMAN_ID ? 'You win' : 'Opponent wins'} the match!</strong>
          </p>
          <button type="button" onClick={onNewMatch}>
            New match
          </button>
        </>
      )}
    </div>
  );
}
