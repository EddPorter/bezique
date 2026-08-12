import type { HandResult } from '../../engine/types.js';
import { HUMAN_ID } from '../playerIds.js';

export function ResultBanner({ result, onPlayAgain }: { result: HandResult; onPlayAgain: () => void }) {
  return (
    <div className="result-banner">
      {result.void ? (
        <p>
          The hand is a tie, even after brisques — per the Portland Club rules, it's <strong>null and void</strong>.
        </p>
      ) : (
        <p>
          {result.winnerId === HUMAN_ID ? 'You win' : 'Opponent wins'} this hand
          {result.rubiconed ? ', and rubicons the loser' : ''} — {result.winnerFinalScore} points
          {' '}({result.roundedScores[0]} to {result.roundedScores[1]}).
        </p>
      )}
      <button type="button" onClick={onPlayAgain}>
        Deal again
      </button>
    </div>
  );
}
