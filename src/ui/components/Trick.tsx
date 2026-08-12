import { Card } from './Card.js';
import type { CurrentTrick, PlayerId } from '../../engine/types.js';

interface TrickProps {
  trick: CurrentTrick;
  humanId: PlayerId;
}

export function Trick({ trick, humanId }: TrickProps) {
  return (
    <div className="trick">
      {trick.leadCard ? (
        <div className="trick-card">
          <span className="trick-label">{trick.leaderId === humanId ? 'You led' : 'Opponent led'}</span>
          <Card card={trick.leadCard} />
        </div>
      ) : (
        <span className="trick-empty">No trick in progress</span>
      )}
    </div>
  );
}
