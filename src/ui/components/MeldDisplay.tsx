import { AnimatePresence, motion } from 'framer-motion';
import { isRedSuit } from './Card.js';
import { SUIT_SYMBOL, parseCardId } from '../../engine/cards.js';
import { MELD_KIND_LABELS } from '../../engine/meldLabels.js';
import type { MeldDeclaration } from '../../engine/types.js';

/** Small, non-interactive stand-in for a card — melded cards stay playable from the
 * hand itself, so this is a summary view, not the same shared-animation element. */
function MiniCard({ cardId }: { cardId: string }) {
  const { suit, rank } = parseCardId(cardId);
  return (
    <span className="mini-card" data-red={isRedSuit(suit)}>
      {rank}
      {SUIT_SYMBOL[suit]}
    </span>
  );
}

interface MeldDisplayProps {
  melds: MeldDeclaration[];
  label: string;
}

export function MeldDisplay({ melds, label }: MeldDisplayProps) {
  if (melds.length === 0) return null;
  return (
    <div className="meld-display">
      <span className="meld-display-label">{label}</span>
      <div className="meld-display-groups">
        <AnimatePresence>
          {melds.map((meld) => (
            <motion.div
              key={meld.id}
              className="meld-group"
              initial={{ opacity: 0, y: 12, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            >
              <span className="meld-group-label">
                {MELD_KIND_LABELS[meld.kind]}
                {meld.suit ? ` (${meld.suit})` : ''} · {meld.points}
              </span>
              <div className="meld-group-cards">
                {meld.cardIds.map((cardId, i) => (
                  <MiniCard key={`${cardId}-${i}`} cardId={cardId} />
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
