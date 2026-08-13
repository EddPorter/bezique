import { AnimatePresence, motion } from 'framer-motion';
import { Card } from './Card.js';
import type { Card as CardModel, Move } from '../../engine/types.js';

interface HandProps {
  hand: CardModel[];
  legalMoves: Move[];
  onPlay: (cardId: string) => void;
}

export function Hand({ hand, legalMoves, onPlay }: HandProps) {
  const playableIds = new Set(
    legalMoves
      .filter((m): m is Extract<Move, { type: 'playCard' }> => m.type === 'playCard')
      .map((m) => m.cardId),
  );
  return (
    <motion.div layout className="hand">
      <AnimatePresence>
        {hand.map((card, i) => (
          <Card
            key={card.id}
            card={card}
            selectable={playableIds.has(card.id)}
            onClick={() => onPlay(card.id)}
            enterDelay={i * 0.035}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
