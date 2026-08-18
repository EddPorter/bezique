import { animate } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { isBrisqueCard } from '../../engine/cards.js';
import type { GameState, PlayerId } from '../../engine/types.js';
import { AI_ID, HUMAN_ID } from '../playerIds.js';

const PHASE_LABELS: Record<GameState['phase'], string> = {
  dealing: 'Dealing',
  main: 'Main phase',
  endgame: 'Endgame',
  scoring: 'Scoring',
  complete: 'Hand complete',
};

function AnimatedNumber({ value }: { value: number }) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const controls = animate(previous.current, value, {
      duration: 0.5,
      ease: 'easeOut',
      onUpdate(v) {
        node.textContent = Math.round(v).toString();
      },
    });
    previous.current = value;
    return () => controls.stop();
  }, [value]);

  return <span ref={nodeRef}>{value}</span>;
}

/** Rules spec §4/§5: brisques only ever count toward the final score to break a near-tie
 * or rescue a rubicon — shown as secondary info so it doesn't read as part of the running total. */
function brisquePoints(state: GameState, playerId: PlayerId): number {
  return state.tricksWon[playerId].filter(isBrisqueCard).length * state.ruleset.brisqueValue;
}

export function ScoreBoard({ state }: { state: GameState }) {
  return (
    <div className="scoreboard">
      <div className="scoreboard-item">
        <span className="scoreboard-label">You</span>
        <span className="scoreboard-value">
          <AnimatedNumber value={state.players[HUMAN_ID].score} />
        </span>
        <span className="scoreboard-sub">
          Brisques: <AnimatedNumber value={brisquePoints(state, HUMAN_ID)} />
        </span>
      </div>
      <div className="scoreboard-item">
        <span className="scoreboard-label">Opponent</span>
        <span className="scoreboard-value">
          <AnimatedNumber value={state.players[AI_ID].score} />
        </span>
        <span className="scoreboard-sub">
          Brisques: <AnimatedNumber value={brisquePoints(state, AI_ID)} />
        </span>
      </div>
      <div className="scoreboard-item">
        <span className="scoreboard-label">Trumps</span>
        <span className="scoreboard-value">{state.trumpSuit ?? '—'}</span>
      </div>
      <div className="scoreboard-item">
        <span className="scoreboard-label">Stock</span>
        <span className="scoreboard-value">{state.deck.length}</span>
      </div>
      <div className="scoreboard-item">
        <span className="scoreboard-label">Phase</span>
        <span className="scoreboard-value">{PHASE_LABELS[state.phase]}</span>
      </div>
    </div>
  );
}
