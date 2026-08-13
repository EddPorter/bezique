import { AnimatePresence, motion } from 'framer-motion';
import { Card } from './Card.js';
import type { CompletedTrick } from '../useGame.js';
import type { CurrentTrick, PlayerId } from '../../engine/types.js';

interface TrickProps {
  trick: CurrentTrick;
  completedTrick: CompletedTrick | null;
  humanId: PlayerId;
}

export function Trick({ trick, completedTrick, humanId }: TrickProps) {
  if (completedTrick) {
    const { leadCard, leaderId, followCard, followerId, winnerId } = completedTrick;
    return (
      <div className="trick">
        <div className="trick-card" data-winner={winnerId === leaderId}>
          <span className="trick-label">{leaderId === humanId ? 'You led' : 'Opponent led'}</span>
          <Card card={leadCard} />
        </div>
        <div className="trick-card" data-winner={winnerId === followerId}>
          <span className="trick-label">{followerId === humanId ? 'You played' : 'Opponent played'}</span>
          <Card card={followCard} />
        </div>
        <motion.p
          className="trick-winner"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {winnerId === humanId ? 'You win the trick' : 'Opponent wins the trick'}
        </motion.p>
      </div>
    );
  }

  return (
    <div className="trick">
      <AnimatePresence mode="wait">
        {trick.leadCard ? (
          <div className="trick-card" key={trick.leadCard.id}>
            <span className="trick-label">{trick.leaderId === humanId ? 'You led' : 'Opponent led'}</span>
            <Card card={trick.leadCard} />
          </div>
        ) : (
          <motion.span
            key="empty"
            className="trick-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            No trick in progress
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
