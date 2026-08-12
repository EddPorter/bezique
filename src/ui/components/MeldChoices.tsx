import { parseCardId } from '../../engine/cards.js';
import type { Move } from '../../engine/types.js';

const MELD_LABELS: Record<string, string> = {
  marriage: 'Marriage',
  sequence: 'Sequence',
  bezique: 'Bezique',
  doubleBezique: 'Double Bezique',
  tripleBezique: 'Triple Bezique',
  quadrupleBezique: 'Quadruple Bezique',
  fourAces: 'Four Aces',
  fourKings: 'Four Kings',
  fourQueens: 'Four Queens',
  fourJacks: 'Four Jacks',
};

interface MeldChoicesProps {
  legalMoves: Move[];
  onChoose: (move: Move) => void;
}

export function MeldChoices({ legalMoves, onChoose }: MeldChoicesProps) {
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
            <button key={i} type="button" onClick={() => onChoose(move)}>
              {MELD_LABELS[move.meldKind] ?? move.meldKind}
              {suitLabel}
            </button>
          );
        })}
        {passMove && (
          <button type="button" className="pass-button" onClick={() => onChoose(passMove)}>
            Pass
          </button>
        )}
      </div>
    </div>
  );
}
