import type { Card as CardModel, Suit } from '../../engine/types.js';

const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RED_SUITS: readonly Suit[] = ['H', 'D'];

interface CardProps {
  card: CardModel;
  selectable?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export function Card({ card, selectable = false, selected = false, onClick }: CardProps) {
  const isRed = RED_SUITS.includes(card.suit);
  return (
    <button
      type="button"
      className="card"
      data-red={isRed}
      data-selectable={selectable}
      data-selected={selected}
      disabled={!selectable}
      onClick={onClick}
      aria-label={`${card.rank} of ${card.suit}`}
    >
      <span className="card-rank">{card.rank}</span>
      <span className="card-suit">{SUIT_SYMBOL[card.suit]}</span>
    </button>
  );
}

export function CardBack() {
  return <div className="card card-back" aria-hidden="true" />;
}
