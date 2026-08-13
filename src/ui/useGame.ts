import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HumanAgent } from '../agents/humanAgent.js';
import { getTutorAdvice, type TutorAdvice } from '../agents/tutor.js';
import type { Agent } from '../agents/types.js';
import { CLUB_PLAYER_TIER, NOVICE_TIER, WeightedAgent, type TierConfig } from '../agents/weightedAgent.js';
import {
  applyMove,
  dealNewHand,
  findCard,
  finalizeScoring,
  getLegalMoves,
  makeRng,
  resolveTrick,
  rubiconBezique,
} from '../engine/index.js';
import type { Card, GameState, Move, PlayerId } from '../engine/types.js';
import { AI_ID, HUMAN_ID } from './playerIds.js';

/** How long a completed trick stays visible (both cards, winner highlighted) before clearing. */
const TRICK_PAUSE_MS = 900;

export interface CompletedTrick {
  leadCard: Card;
  leaderId: PlayerId;
  followCard: Card;
  followerId: PlayerId;
  winnerId: PlayerId;
}

/**
 * Drives the game loop through the same Agent interface for both players
 * (architecture plan §5): whichever player owns the current turn gets asked
 * via `chooseMove`. The human agent's promise just stays pending until the
 * UI calls `submitMove`; the AI resolves on its own after a short "thinking" delay.
 *
 * A resolved trick is held in `completedTrick` for a beat before the engine
 * move is actually applied, purely so the UI has time to show both cards and
 * the winner — the engine itself resolves and clears a trick instantly.
 */
export function useGame() {
  const humanAgent = useRef(new HumanAgent()).current;
  const [aiTier, setAiTier] = useState<TierConfig>(CLUB_PLAYER_TIER);
  const [tutorEnabled, setTutorEnabled] = useState(false);
  const agentsRef = useRef<[Agent, Agent]>([humanAgent, new WeightedAgent(AI_ID, aiTier)]);

  // The opponent can change tier mid-session (no persistence yet — that's step 8); keep the
  // agent instance in sync via a ref so the game-loop effect below always sees the latest one
  // without needing `aiTier` in its own dependency array.
  useEffect(() => {
    agentsRef.current[1] = new WeightedAgent(AI_ID, aiTier);
  }, [aiTier]);

  const [state, setState] = useState<GameState>(() => dealNewHand(rubiconBezique, AI_ID, makeRng(Date.now())));
  const [completedTrick, setCompletedTrick] = useState<CompletedTrick | null>(null);

  const startNewHand = useCallback(() => {
    setCompletedTrick(null);
    setState((prev) => {
      const nextDealer: PlayerId = prev.dealerId === 0 ? 1 : 0;
      return dealNewHand(rubiconBezique, nextDealer, makeRng(Date.now()));
    });
  }, []);

  useEffect(() => {
    if (state.phase === 'scoring') {
      setState((current) => (current === state ? finalizeScoring(current) : current));
      return;
    }
    if (state.phase === 'complete') return;

    const legalMoves = getLegalMoves(state, state.turn);
    if (legalMoves.length === 0) return;

    let cancelled = false;
    let pauseTimer: ReturnType<typeof setTimeout> | undefined;

    agentsRef.current[state.turn].chooseMove(state, legalMoves).then((move) => {
      if (cancelled) return;

      if (move.type === 'playCard' && state.stage === 'awaitingFollow' && state.currentTrick.leadCard) {
        const leadCard = state.currentTrick.leadCard;
        const leaderId = state.currentTrick.leaderId;
        const followCard = findCard(state.players[state.turn].hand, move.cardId)!;
        const winnerId = resolveTrick(leadCard, leaderId, followCard, state.turn, state.trumpSuit);
        setCompletedTrick({ leadCard, leaderId, followCard, followerId: state.turn, winnerId });
        pauseTimer = setTimeout(() => {
          if (cancelled) return;
          setCompletedTrick(null);
          setState((current) => (current === state ? applyMove(current, move) : current));
        }, TRICK_PAUSE_MS);
        return;
      }

      setState((current) => (current === state ? applyMove(current, move) : current));
    });

    return () => {
      cancelled = true;
      if (pauseTimer) clearTimeout(pauseTimer);
    };
  }, [state]);

  // Derived purely from `state` (reactive) rather than the agent's internal ref field
  // (mutating that field doesn't itself trigger a re-render, so it can't drive the UI).
  const isHumanTurn =
    state.turn === HUMAN_ID && state.phase !== 'scoring' && state.phase !== 'complete' && completedTrick === null;
  const legalMoves: Move[] = isHumanTurn ? getLegalMoves(state, HUMAN_ID) : [];

  const submitMove = useCallback(
    (move: Move) => {
      if (state.turn !== HUMAN_ID || !humanAgent.isAwaitingMove) return;
      humanAgent.provideMove(move);
    },
    [state, humanAgent],
  );

  // Read-only advisor (architecture plan §5): never chooses a move itself, just ranks
  // the human's own legal moves and surfaces the top one with an explanation.
  const tutorAdvice: TutorAdvice | null = useMemo(
    () => (tutorEnabled && isHumanTurn && legalMoves.length > 0 ? getTutorAdvice(state, HUMAN_ID, legalMoves) : null),
    [tutorEnabled, isHumanTurn, legalMoves, state],
  );

  // "A low/mid-tier AI opponent paired with the tutor turned on" (architecture plan §5) —
  // training mode is just a one-click preset for that combination, not a separate mode
  // to maintain. Turning it ON sets both; turning it OFF only relaxes the difficulty back
  // to normal — it deliberately leaves the Tutor toggle alone, since wanting to stop
  // practicing against an easy opponent isn't the same as wanting the advice to disappear.
  const trainingModeOn = tutorEnabled && aiTier.name === NOVICE_TIER.name;
  const setTrainingMode = useCallback((on: boolean) => {
    if (on) {
      setTutorEnabled(true);
      setAiTier(NOVICE_TIER);
    } else {
      setAiTier(CLUB_PLAYER_TIER);
    }
  }, []);

  return {
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
    trainingModeOn,
    setTrainingMode,
  };
}
