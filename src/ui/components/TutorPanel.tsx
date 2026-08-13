import { motion } from 'framer-motion';
import type { TutorAdvice } from '../../agents/tutor.js';

export function TutorPanel({ advice }: { advice: TutorAdvice }) {
  return (
    <motion.div
      className="tutor-panel"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
    >
      <span className="tutor-panel-label">Tutor</span>
      <span className="tutor-panel-text">{advice.explanation}</span>
    </motion.div>
  );
}
