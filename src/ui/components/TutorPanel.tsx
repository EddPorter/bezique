import { motion } from 'framer-motion';
import type { TutorAdvice } from '../../agents/tutor.js';

/** Groups alternatives that share the identical reason into one line ("Q♠, K♠ — costs
 * more in meld potential") instead of repeating the same sentence per card — matters
 * once a hand has enough cards that many of them land on the same explanation. */
function groupByReason(alternatives: TutorAdvice['alternatives']): { labels: string[]; reason: string }[] {
  const order: string[] = [];
  const labelsByReason = new Map<string, string[]>();
  for (const { label, reason } of alternatives) {
    const existing = labelsByReason.get(reason);
    if (existing) {
      existing.push(label);
    } else {
      labelsByReason.set(reason, [label]);
      order.push(reason);
    }
  }
  return order.map((reason) => ({ reason, labels: labelsByReason.get(reason)! }));
}

export function TutorPanel({ advice }: { advice: TutorAdvice }) {
  const grouped = groupByReason(advice.alternatives);
  return (
    <motion.div
      className="tutor-panel"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
    >
      <div className="tutor-panel-main">
        <span className="tutor-panel-label">Tutor</span>
        <span className="tutor-panel-text">{advice.explanation}</span>
      </div>
      {grouped.length > 0 && (
        <details className="tutor-alternatives">
          <summary>Why not the others?</summary>
          <ul>
            {grouped.map(({ labels, reason }) => (
              <li key={reason}>
                {labels.join(', ')} — {reason}.
              </li>
            ))}
          </ul>
        </details>
      )}
    </motion.div>
  );
}
