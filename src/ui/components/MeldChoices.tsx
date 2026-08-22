import { parseCardId } from '../../engine/cards.js';
import { MELD_KIND_LABELS } from '../../engine/meldLabels.js';
import type { Card, Move } from '../../engine/types.js';

interface MeldChoicesProps {
  legalMoves: Move[];
  onChoose: (move: Move) => void;
  recommendedMove?: Move | null;
  /** Classic Bezique only (docs/classic-bezique-rules-spec.md §2): whether declaring a dix
   * right now would also exchange it for this card, purely to word the button correctly. */
  turnUpCard?: Card | null;
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
  if (a.type === 'declareDix' && b.type === 'declareDix') {
    return a.cardId === b.cardId;
  }
  return a.type === 'pass' && b.type === 'pass';
}

export function MeldChoices({ legalMoves, onChoose, recommendedMove = null, turnUpCard = null }: MeldChoicesProps) {
  const declareMoves = legalMoves.filter(
    (m): m is Extract<Move, { type: 'declareMeld' }> => m.type === 'declareMeld',
  );
  const dixMoves = legalMoves.filter((m): m is Extract<Move, { type: 'declareDix' }> => m.type === 'declareDix');
  const passMove = legalMoves.find((m) => m.type === 'pass');
  if (declareMoves.length === 0 && dixMoves.length === 0 && !passMove) return null;

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
        {dixMoves.map((move) => (
          <button
            key={move.cardId}
            type="button"
            data-recommended={recommendedMove ? isSameMove(move, recommendedMove) : false}
            onClick={() => onChoose(move)}
          >
            {turnUpCard ? 'Exchange dix for turn-up' : 'Declare dix'}
          </button>
        ))}
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
