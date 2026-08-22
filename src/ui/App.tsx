import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { CarteBlancheBanner } from './components/CarteBlancheBanner.js';
import { Card, CardBack } from './components/Card.js';
import { Hand } from './components/Hand.js';
import { HelpSheet } from './components/HelpSheet.js';
import { MatchDealBanner } from './components/MatchDealBanner.js';
import { MeldChoices } from './components/MeldChoices.js';
import { MeldDisplay } from './components/MeldDisplay.js';
import { ResultBanner } from './components/ResultBanner.js';
import { ScoreBoard } from './components/ScoreBoard.js';
import { Trick } from './components/Trick.js';
import { TutorPanel } from './components/TutorPanel.js';
import { HAND_SORT_MODES, sortHand, type HandSortMode } from './handSort.js';
import { AI_ID, HUMAN_ID } from './playerIds.js';
import { useGame } from './useGame.js';
import { VARIANTS } from './variants.js';
import { AI_TIERS } from '../agents/weightedAgent.js';
import type { Move } from '../engine/types.js';

export function App() {
  const {
    state,
    legalMoves,
    submitMove,
    startNewHand,
    variant,
    changeVariant,
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
    match,
    startNextDeal,
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

  // A completed deal is only "safe to discard without asking" if there's nothing riding on
  // it: either there's no match at all (Rubicon/Chinese Bezique — the deal being over IS the
  // whole game), or the match itself has already concluded. Mid-match, a completed deal is
  // just a transition screen with real accumulated score behind it — that's exactly the
  // in-progress state confirmDiscardInProgress exists to protect.
  const matchInProgress = match !== null && match.winnerId === null;
  /** Shared by "New Game" and the variant switch — both discard the current hand/match. */
  const confirmDiscardInProgress = (message: string) =>
    (!matchInProgress && state.phase === 'complete') || window.confirm(message);

  return (
    <main className="table">
      <div className="table-header">
        <h1>Bezique</h1>
        <div className="table-header-buttons">
          <button
            type="button"
            className="help-toggle"
            onClick={() => {
              if (confirmDiscardInProgress('Start a new game? The current hand will be lost.')) {
                startNewHand();
              }
            }}
          >
            New Game
          </button>
          <button type="button" className="help-toggle" onClick={() => setHelpOpen(true)}>
            Help
          </button>
        </div>
      </div>
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} ruleset={state.ruleset} variantName={variant.name} />

      <div className="game-layout">
        <div className="main-column">
          <div className="scoreboard-mobile">
            <ScoreBoard state={state} match={match} />
          </div>

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
            {state.turnUpCard && (
              <div className="turn-up-card">
                <span className="turn-up-card-label">Turn-up</span>
                <Card card={state.turnUpCard} />
              </div>
            )}
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
              <MeldChoices
                legalMoves={legalMoves}
                onChoose={handleMeldChoice}
                recommendedMove={tutorAdvice?.move}
                turnUpCard={state.turnUpCard}
              />
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
          <div className="scoreboard-desktop">
            <ScoreBoard state={state} match={match} />
          </div>

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

            <label className="tier-select" title="Switching starts a new game under the chosen ruleset.">
              <span>Variant</span>
              <select
                name="game-variant"
                value={variant.name}
                onChange={(e) => {
                  const next = VARIANTS.find((v) => v.name === e.target.value);
                  if (next && next.name !== variant.name && confirmDiscardInProgress(`Switch to ${next.name}? The current hand will be lost.`)) {
                    changeVariant(next);
                  }
                }}
              >
                {VARIANTS.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {state.phase === 'complete' && match && (
            <MatchDealBanner match={match} onNextDeal={startNextDeal} onNewMatch={startNewHand} />
          )}
          {state.phase === 'complete' && !match && state.result && (
            <ResultBanner result={state.result} onPlayAgain={startNewHand} />
          )}
        </aside>
      </div>
    </main>
  );
}
