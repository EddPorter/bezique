import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { CarteBlancheBanner } from './components/CarteBlancheBanner.js';
import { Card, CardBack } from './components/Card.js';
import { Hand } from './components/Hand.js';
import { HelpSheet } from './components/HelpSheet.js';
import { MeldChoices } from './components/MeldChoices.js';
import { MeldDisplay } from './components/MeldDisplay.js';
import { ResultBanner } from './components/ResultBanner.js';
import { ScoreBoard } from './components/ScoreBoard.js';
import { Trick } from './components/Trick.js';
import { TutorPanel } from './components/TutorPanel.js';
import { HAND_SORT_MODES, sortHand, type HandSortMode } from './handSort.js';
import { AI_ID, HUMAN_ID } from './playerIds.js';
import { useGame } from './useGame.js';
import { AI_TIERS } from '../agents/weightedAgent.js';
import type { Move } from '../engine/types.js';

export function App() {
  const {
    state,
    legalMoves,
    submitMove,
    startNewHand,
    isHumanTurn,
    completedTrick,
    aiTier,
    setAiTier,
    tutorEnabled,
    setTutorEnabled,
    tutorAdvice,
    insightsEnabled,
    setInsightsEnabled,
    cardInsights,
    carteBlancheAnnouncement,
  } = useGame();
  const [helpOpen, setHelpOpen] = useState(false);
  const [handSortMode, setHandSortMode] = useState<HandSortMode>('suitRank');
  const [cheatMode, setCheatMode] = useState(false);
  const human = state.players[HUMAN_ID];
  const opponent = state.players[AI_ID];
  const opponentThinking = state.turn === AI_ID && state.phase !== 'complete' && completedTrick === null;
  const recommendedCardId =
    tutorAdvice && tutorAdvice.move.type === 'playCard' ? tutorAdvice.move.cardId : null;
  // Public info either way — which specific cards have been captured in tricks doesn't
  // require seeing anyone's hand, so this drives the depleted/standing meld display for
  // both players identically.
  const playedCardIds = new Set([...state.tricksWon[0], ...state.tricksWon[1]].map((c) => c.id));
  const humanMeldCardIds = new Set(human.melds.flatMap((m) => m.cardIds));
  const sortedHumanHand = sortHand(human.hand, handSortMode, humanMeldCardIds);
  // Cheat mode (PROJECT-BRIEF.md step 7): the opponent's hand is already public data in
  // GameState (the engine always has full information — architecture plan §1), so this is
  // purely a display toggle, never a state/legality change. Always suit+rank sorted for
  // readability, independent of the human's own sort preference.
  const opponentMeldCardIds = new Set(opponent.melds.flatMap((m) => m.cardIds));
  const sortedOpponentHand = sortHand(opponent.hand, 'suitRank', opponentMeldCardIds);

  const handlePlay = (cardId: string) => {
    submitMove({ type: 'playCard', playerId: HUMAN_ID, cardId });
  };

  const handleMeldChoice = (move: Move) => {
    submitMove(move);
  };

  return (
    <div className="table">
      <div className="table-header">
        <h1>Bezique</h1>
        <button type="button" className="help-toggle" onClick={() => setHelpOpen(true)}>
          Help
        </button>
      </div>
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />

      <div className="game-layout">
        <div className="main-column">
          <section className="opponent-area">
            <h2>Opponent</h2>
            <div className="hand">
              <AnimatePresence>
                {cheatMode
                  ? sortedOpponentHand.map((card) => (
                      <Card key={card.id} card={card} partOfMeld={opponentMeldCardIds.has(card.id)} />
                    ))
                  : opponent.hand.map((card) => <CardBack key={card.id} card={card} />)}
              </AnimatePresence>
            </div>
            <MeldDisplay melds={opponent.melds} label="Opponent's melds" playedCardIds={playedCardIds} />
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
              <MeldChoices legalMoves={legalMoves} onChoose={handleMeldChoice} recommendedMove={tutorAdvice?.move} />
            )}
            <AnimatePresence>{tutorAdvice && <TutorPanel advice={tutorAdvice} />}</AnimatePresence>
          </section>

          <section className="human-area">
            <div className="human-area-header">
              <h2>You</h2>
              <label className="tier-select hand-sort-select">
                <span>Sort</span>
                <select
                  name="hand-sort-mode"
                  value={handSortMode}
                  onChange={(e) => setHandSortMode(e.target.value as HandSortMode)}
                >
                  {HAND_SORT_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Hand
              hand={sortedHumanHand}
              legalMoves={isHumanTurn && state.stage !== 'awaitingMeldDecision' ? legalMoves : []}
              onPlay={handlePlay}
              recommendedCardId={recommendedCardId}
              meldCardIds={humanMeldCardIds}
              cardInsights={cardInsights}
            />
            <MeldDisplay melds={human.melds} label="Your melds" playedCardIds={playedCardIds} />
          </section>
        </div>

        <aside className="side-panel">
          <ScoreBoard state={state} />

          <AnimatePresence>
            {carteBlancheAnnouncement && <CarteBlancheBanner announcement={carteBlancheAnnouncement} />}
          </AnimatePresence>

          <div className="assist-toggles">
            <label className="toggle" title="Shows move advice from the tutor.">
              <input type="checkbox" checked={tutorEnabled} onChange={(e) => setTutorEnabled(e.target.checked)} />
              Tutor
            </label>

            <label
              className="toggle"
              title="Hover a card in your hand to see how the evaluator scores playing it right now."
            >
              <input
                type="checkbox"
                checked={insightsEnabled}
                onChange={(e) => setInsightsEnabled(e.target.checked)}
              />
              Insights
            </label>

            <label className="toggle" title="Reveals the opponent's hand. Doesn't affect their play.">
              <input type="checkbox" checked={cheatMode} onChange={(e) => setCheatMode(e.target.checked)} />
              Cheat
            </label>

            <label className="tier-select">
              <span>Difficulty</span>
              <select
                name="opponent-difficulty"
                value={aiTier.name}
                onChange={(e) => {
                  const next = AI_TIERS.find((t) => t.name === e.target.value);
                  if (next) setAiTier(next);
                }}
              >
                {AI_TIERS.map((tier) => (
                  <option key={tier.name} value={tier.name}>
                    {tier.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {state.phase === 'complete' && state.result && (
            <ResultBanner result={state.result} onPlayAgain={startNewHand} />
          )}
        </aside>
      </div>
    </div>
  );
}
