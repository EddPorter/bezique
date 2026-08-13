import { motion } from 'framer-motion';
import type { CarteBlancheAnnouncement } from '../useGame.js';
import { HUMAN_ID } from '../playerIds.js';

export function CarteBlancheBanner({ announcement }: { announcement: CarteBlancheAnnouncement }) {
  const who = announcement.playerId === HUMAN_ID ? 'You have' : 'Opponent has';
  return (
    <motion.div
      className="carte-blanche-banner"
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    >
      {who} Carte Blanche — a hand with no court cards, worth +{announcement.amount} points.
    </motion.div>
  );
}
