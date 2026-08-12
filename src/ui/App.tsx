import { CardBack } from './components/Card.js';
import { Hand } from './components/Hand.js';
import { MeldChoices } from './components/MeldChoices.js';
import { ResultBanner } from './components/ResultBanner.js';
import { ScoreBoard } from './components/ScoreBoard.js';
import { Trick } from './components/Trick.js';
import { AI_ID, HUMAN_ID } from './playerIds.js';
import { useGame } from './useGame.js';
import type { Move } from '../engine/types.js';

export function App() {
  const { state, legalMoves, submitMove, startNewHand, isHumanTurn } = useGame();
  const human = state.players[HUMAN_ID];
  const opponent = state.players[AI_ID];

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
          {opponent.hand.map((_, i) => (
            <CardBack key={i} />
          ))}
        </div>
      </section>

      <section className="middle-area">
        <Trick trick={state.currentTrick} humanId={HUMAN_ID} />
        {!isHumanTurn && state.phase !== 'complete' && <p className="thinking">Opponent is thinking…</p>}
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
      </section>
    </div>
  );
}
