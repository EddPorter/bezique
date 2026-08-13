import { AnimatePresence, motion } from 'framer-motion';
import { isRedSuit } from './Card.js';
import { SUIT_SYMBOL, parseCardId } from '../../engine/cards.js';
import { MELD_KIND_LABELS } from '../../engine/meldLabels.js';
import type { MeldDeclaration } from '../../engine/types.js';

/** Small, non-interactive stand-in for a card — melded cards stay playable from the
 * hand itself, so this is a summary view, not the same shared-animation element.
 * `depleted` cards have already been played to a trick (public info — a card's
 * captured/not-captured status doesn't require seeing anyone's actual hand) and are
 * shown hollow rather than filled, since a spare could refresh them via replacement
 * re-declaration (rules spec §3). Works identically for the opponent's melds: no
 * cheat-mode concerns, since `tricksWon` is exactly as public as the melds themselves. */
function MiniCard({ cardId, depleted }: { cardId: string; depleted: boolean }) {
  const { suit, rank } = parseCardId(cardId);
  return (
    <span className="mini-card" data-red={isRedSuit(suit)} data-depleted={depleted}>
      {rank}
      {SUIT_SYMBOL[suit]}
    </span>
  );
}

interface MeldDisplayProps {
  melds: MeldDeclaration[];
  label: string;
  playedCardIds: ReadonlySet<string>;
}

export function MeldDisplay({ melds, label, playedCardIds }: MeldDisplayProps) {
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
                  <MiniCard key={`${cardId}-${i}`} cardId={cardId} depleted={playedCardIds.has(cardId)} />
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
