import { motion } from 'framer-motion';
import { SUIT_SYMBOL } from '../../engine/cards.js';
import type { Card as CardModel, Suit } from '../../engine/types.js';

const RED_SUITS: readonly Suit[] = ['H', 'D'];

export function isRedSuit(suit: Suit): boolean {
  return RED_SUITS.includes(suit);
}

const SPRING = { type: 'spring', stiffness: 500, damping: 32 } as const;

interface CardProps {
  card: CardModel;
  selectable?: boolean;
  onClick?: () => void;
  enterDelay?: number;
  recommended?: boolean;
  /** Part of one of your own currently-declared melds — playing it away would break that meld. */
  partOfMeld?: boolean;
}

export function Card({
  card,
  selectable = false,
  onClick,
  enterDelay = 0,
  recommended = false,
  partOfMeld = false,
}: CardProps) {
  const isRed = RED_SUITS.includes(card.suit);
  const symbol = SUIT_SYMBOL[card.suit];
  return (
    <motion.button
      layoutId={card.id}
      layout
      type="button"
      className="card"
      data-red={isRed}
      data-selectable={selectable}
      data-recommended={recommended}
      data-part-of-meld={partOfMeld}
      disabled={!selectable}
      onClick={onClick}
      transition={{ layout: SPRING, default: { ...SPRING, delay: enterDelay } }}
      initial={{ opacity: 0, scale: 0.8, y: -12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileHover={selectable ? { y: -10 } : undefined}
      whileTap={selectable ? { scale: 0.95, y: -4 } : undefined}
      aria-label={`${card.rank} of ${card.suit}${partOfMeld ? ', part of a declared meld' : ''}`}
    >
      <span className="card-corner card-corner-top">
        <span className="card-corner-rank">{card.rank}</span>
        <span className="card-corner-suit">{symbol}</span>
      </span>
      <span className="card-center">{symbol}</span>
      <span className="card-corner card-corner-bottom">
        <span className="card-corner-rank">{card.rank}</span>
        <span className="card-corner-suit">{symbol}</span>
      </span>
      {partOfMeld && <span className="card-meld-dot" aria-hidden="true" />}
    </motion.button>
  );
}

export function CardBack({ card }: { card?: CardModel }) {
  return (
    <motion.div
      layoutId={card ? card.id : undefined}
      layout
      className="card card-back"
      transition={SPRING}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      aria-hidden="true"
    />
  );
}
