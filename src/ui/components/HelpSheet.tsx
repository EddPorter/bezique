import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { buildHelpSheetContent } from '../../engine/helpSheet.js';
import { rubiconBezique } from '../../engine/ruleset.js';

interface HelpSheetProps {
  open: boolean;
  onClose: () => void;
}

// Ruleset never changes at runtime — safe to build once at module scope.
const content = buildHelpSheetContent(rubiconBezique);

/** How close to an edge (px) counts as "there" for the scroll-fade cue below. */
const SCROLL_EDGE_THRESHOLD = 4;

export function HelpSheet({ open, onClose }: HelpSheetProps) {
  const tableWrapRef = useRef<HTMLDivElement>(null);
  // The meld table can be wider than the panel on narrow screens (`.help-table-wrap`
  // scrolls horizontally) — without a visible cue that's indistinguishable from the
  // text just being truncated. Tracks scroll position so a fade only shows on whichever
  // edge(s) still have more content past them.
  const [scrollCue, setScrollCue] = useState({ left: false, right: false });

  const updateScrollCue = () => {
    const el = tableWrapRef.current;
    if (!el) return;
    setScrollCue({
      left: el.scrollLeft > SCROLL_EDGE_THRESHOLD,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - SCROLL_EDGE_THRESHOLD,
    });
  };

  useEffect(() => {
    if (!open) return;
    updateScrollCue();
    window.addEventListener('resize', updateScrollCue);
    return () => window.removeEventListener('resize', updateScrollCue);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="help-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="help-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Rubicon Bezique help sheet"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="help-header">
              <h2>Rubicon Bezique — Help Sheet</h2>
              <button type="button" className="help-close" onClick={onClose} aria-label="Close help sheet">
                ×
              </button>
            </div>

            <section>
              <h3>Deck &amp; deal</h3>
              <p>
                {content.deckCopies} combined 32-card packs — {content.totalCards} cards total. Each player is
                dealt {content.cardsPerPlayer}. Rank, high to low: {content.rankOrderHighToLow}.
              </p>
            </section>

            <section>
              <h3>Melds</h3>
              <div
                className="help-table-wrap"
                ref={tableWrapRef}
                onScroll={updateScrollCue}
                data-scroll-left={scrollCue.left}
                data-scroll-right={scrollCue.right}
              >
                <table className="help-meld-table">
                  <thead>
                    <tr>
                      <th>Meld</th>
                      <th>Cards</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.meldTable.map((row) => (
                      <tr key={row.kind}>
                        <td>{row.label}</td>
                        <td>
                          {row.cards}
                          {row.suitNote && <span className="help-suit-note"> ({row.suitNote})</span>}
                        </td>
                        <td>{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="help-note">
                One meld may be declared per trick won. A card already scored in a class (Sequences: Marriage →
                Sequence; Bezique: Single → Double → Triple → Quadruple) can go on to score a higher combination
                of that class, but never a lower one — and it's always free to score in a different class
                entirely (e.g. a King in a Marriage can also complete Four Kings).
              </p>
              <p className="help-note">
                Once a card from a declared meld has been played to a trick, that combination can be
                reconstructed — using a spare card borrowed from another standing meld — and scored again.
              </p>
              <p className="help-note">
                Carte blanche (dealt a hand with no J/Q/K/A at all) scores {content.carteBlanchePoints} points,
                re-declarable each time a fresh card is drawn without breaking the condition.
              </p>
            </section>

            <section>
              <h3>Endgame</h3>
              <p>
                Once the stock runs out, melded cards return to hand and no further melds may be declared. For
                the remaining tricks you must follow suit if able, and must win the trick if able. Winning the
                last trick scores {content.lastTrickBonus} points. Every Ace or 10 you've captured in tricks is
                worth {content.brisqueValue} points as a brisque — but brisques only count toward your total to
                break a near-tie, or to save you from a rubicon.
              </p>
            </section>

            <section>
              <h3>Scoring</h3>
              <p>
                Round your meld total down to the nearest {content.roundTo}. The higher score wins and scores
                the difference plus a {content.gameBonus}-point game bonus. If the loser's rounded score is
                below {content.rubiconThreshold}, they're <strong>rubiconed</strong> — the winner's score
                instead becomes both rounded totals added together, plus {content.rubiconBonus}. If the two
                totals are still exactly equal even after brisques, the hand is null and void.
              </p>
            </section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
