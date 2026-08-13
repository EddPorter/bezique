import { parseCardId } from '../../engine/cards.js';
import { MELD_KIND_LABELS } from '../../engine/meldLabels.js';
import type { Move } from '../../engine/types.js';

interface MeldChoicesProps {
  legalMoves: Move[];
  onChoose: (move: Move) => void;
  recommendedMove?: Move | null;
}

function isSameMove(a: Move, b: Move): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'declareMeld' && b.type === 'declareMeld') {
    return (
      a.meldKind === b.meldKind &&
      a.cardIds.length === b.cardIds.length &&
      a.cardIds.every((id) => b.cardIds.includes(id))
    );
  }
  return a.type === 'pass' && b.type === 'pass';
}

export function MeldChoices({ legalMoves, onChoose, recommendedMove = null }: MeldChoicesProps) {
  const declareMoves = legalMoves.filter(
    (m): m is Extract<Move, { type: 'declareMeld' }> => m.type === 'declareMeld',
  );
  const passMove = legalMoves.find((m) => m.type === 'pass');
  if (declareMoves.length === 0 && !passMove) return null;

  return (
    <div className="meld-choices">
      <p>You won the trick — declare a meld?</p>
      <div className="meld-choices-buttons">
        {declareMoves.map((move, i) => {
          const suits = [...new Set(move.cardIds.map((id) => parseCardId(id).suit))];
          const suitLabel = suits.length === 1 ? ` (${suits[0]})` : '';
          return (
            <button
              key={i}
              type="button"
              data-recommended={recommendedMove ? isSameMove(move, recommendedMove) : false}
              onClick={() => onChoose(move)}
            >
              {MELD_KIND_LABELS[move.meldKind]}
              {suitLabel}
            </button>
          );
        })}
        {passMove && (
          <button
            type="button"
            className="pass-button"
            data-recommended={recommendedMove ? isSameMove(passMove, recommendedMove) : false}
            onClick={() => onChoose(passMove)}
          >
            Pass
          </button>
        )}
      </div>
    </div>
  );
}
