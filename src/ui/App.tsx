import { AnimatePresence, motion } from 'framer-motion';
import { CardBack } from './components/Card.js';
import { Hand } from './components/Hand.js';
import { MeldChoices } from './components/MeldChoices.js';
import { MeldDisplay } from './components/MeldDisplay.js';
import { ResultBanner } from './components/ResultBanner.js';
import { ScoreBoard } from './components/ScoreBoard.js';
import { Trick } from './components/Trick.js';
import { AI_ID, HUMAN_ID } from './playerIds.js';
import { useGame } from './useGame.js';
import type { Move } from '../engine/types.js';

export function App() {
  const { state, legalMoves, submitMove, startNewHand, isHumanTurn, completedTrick } = useGame();
  const human = state.players[HUMAN_ID];
  const opponent = state.players[AI_ID];
  const opponentThinking = state.turn === AI_ID && state.phase !== 'complete' && completedTrick === null;

  const handlePlay = (cardId: string) => {
    submitMove({ type: 'playCard', playerId: HUMAN_ID, cardId });
  };

  const handleMeldChoice = (move: Move) => {
    submitMove(move);
  };

  return (
    <div className="table">
      <h1>Bezique</h1>
      <ScoreBoard state={state} />

      <section className="opponent-area">
        <h2>Opponent</h2>
        <div className="hand">
          <AnimatePresence>
            {opponent.hand.map((card) => (
              <CardBack key={card.id} card={card} />
            ))}
          </AnimatePresence>
        </div>
        <MeldDisplay melds={opponent.melds} label="Opponent's melds" />
      </section>

      <section className="middle-area">
        <Trick trick={state.currentTrick} completedTrick={completedTrick} humanId={HUMAN_ID} />
        <AnimatePresence>
          {opponentThinking && (
            <motion.p
              className="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Opponent is thinking
              <span className="thinking-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </motion.p>
          )}
        </AnimatePresence>
        {isHumanTurn && state.stage === 'awaitingMeldDecision' && (
          <MeldChoices legalMoves={legalMoves} onChoose={handleMeldChoice} />
        )}
      </section>

      {state.phase === 'complete' && state.result && (
        <ResultBanner result={state.result} onPlayAgain={startNewHand} />
      )}

      <section className="human-area">
        <h2>You</h2>
        <Hand
          hand={human.hand}
          legalMoves={isHumanTurn && state.stage !== 'awaitingMeldDecision' ? legalMoves : []}
          onPlay={handlePlay}
        />
        <MeldDisplay melds={human.melds} label="Your melds" />
      </section>
    </div>
  );
}
