import { motion } from 'framer-motion';
import type { Card as CardModel, Suit } from '../../engine/types.js';

export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
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
}

export function Card({ card, selectable = false, onClick, enterDelay = 0 }: CardProps) {
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
      disabled={!selectable}
      onClick={onClick}
      transition={{ layout: SPRING, default: { ...SPRING, delay: enterDelay } }}
      initial={{ opacity: 0, scale: 0.8, y: -12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileHover={selectable ? { y: -10 } : undefined}
      whileTap={selectable ? { scale: 0.95, y: -4 } : undefined}
      aria-label={`${card.rank} of ${card.suit}`}
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
