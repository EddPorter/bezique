import { AnimatePresence, motion } from 'framer-motion';
import { Card } from './Card.js';
import type { EvaluationBreakdown } from '../../agents/evaluation.js';
import type { Card as CardModel, Move } from '../../engine/types.js';

interface HandProps {
  hand: CardModel[];
  legalMoves: Move[];
  onPlay: (cardId: string) => void;
  recommendedCardId?: string | null;
  meldCardIds?: ReadonlySet<string>;
  /** Debug/analysis breakdown per card, keyed by card id — see the "Insights" toggle. */
  cardInsights?: Map<string, EvaluationBreakdown> | null;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

function formatInsight(breakdown: EvaluationBreakdown): string {
  return [
    `Total: ${round1(breakdown.total)}`,
    `Trick value: ${round1(breakdown.trickValue)}`,
    `Meld progress: ${round1(breakdown.meldProgress)}`,
    `Brisque/trump risk: ${round1(breakdown.brisqueRisk)}`,
    `Information given away: ${round1(breakdown.informationGivenAway)}`,
  ].join('\n');
}

export function Hand({ hand, legalMoves, onPlay, recommendedCardId = null, meldCardIds, cardInsights }: HandProps) {
  const playableIds = new Set(
    legalMoves
      .filter((m): m is Extract<Move, { type: 'playCard' }> => m.type === 'playCard')
      .map((m) => m.cardId),
  );
  return (
    <motion.div layout className="hand">
      <AnimatePresence>
        {hand.map((card, i) => {
          const insight = cardInsights?.get(card.id);
          return (
            <Card
              key={card.id}
              card={card}
              selectable={playableIds.has(card.id)}
              onClick={() => onPlay(card.id)}
              enterDelay={i * 0.035}
              recommended={card.id === recommendedCardId}
              partOfMeld={meldCardIds?.has(card.id) ?? false}
              title={insight ? formatInsight(insight) : undefined}
            />
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
