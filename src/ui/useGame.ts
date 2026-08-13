import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { evaluateMove, makeCardMemoryRiskEstimator, type EvaluationBreakdown } from '../agents/evaluation.js';
import { HumanAgent } from '../agents/humanAgent.js';
import { getTutorAdvice, type TutorAdvice } from '../agents/tutor.js';
import type { Agent } from '../agents/types.js';
import { CLUB_PLAYER_TIER, EXPERT_TIER, WeightedAgent, type TierConfig } from '../agents/weightedAgent.js';
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

export interface CarteBlancheAnnouncement {
  playerId: PlayerId;
  amount: number;
}

/** How long a carte blanche announcement stays visible before clearing. */
const CARTE_BLANCHE_ANNOUNCEMENT_MS = 3500;

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
  const [insightsEnabled, setInsightsEnabled] = useState(false);
  const agentsRef = useRef<[Agent, Agent]>([humanAgent, new WeightedAgent(AI_ID, aiTier)]);

  // The opponent can change tier mid-session (no persistence yet — that's step 8); keep the
  // agent instance in sync via a ref so the game-loop effect below always sees the latest one
  // without needing `aiTier` in its own dependency array.
  useEffect(() => {
    agentsRef.current[1] = new WeightedAgent(AI_ID, aiTier);
  }, [aiTier]);

  const [state, setState] = useState<GameState>(() => dealNewHand(rubiconBezique, AI_ID, makeRng(Date.now())));
  const [completedTrick, setCompletedTrick] = useState<CompletedTrick | null>(null);

  // Carte blanche (rules spec §3) is auto-detected and scored directly rather than modeled
  // as a persistent meld (see docs/PROJECT-BRIEF.md) — which means, without this, it was
  // completely silent: a real 50-point jump with no meld record and no announcement to
  // explain it. Tracks the last-seen total per player so a genuine increase (initial deal,
  // or any later draw that still has zero court cards) can be announced.
  const prevCarteBlancheRef = useRef<Record<PlayerId, number>>({ 0: 0, 1: 0 });
  const [carteBlancheAnnouncement, setCarteBlancheAnnouncement] = useState<CarteBlancheAnnouncement | null>(null);

  const startNewHand = useCallback(() => {
    setCompletedTrick(null);
    setCarteBlancheAnnouncement(null);
    prevCarteBlancheRef.current = { 0: 0, 1: 0 };
    setState((prev) => {
      const nextDealer: PlayerId = prev.dealerId === 0 ? 1 : 0;
      return dealNewHand(rubiconBezique, nextDealer, makeRng(Date.now()));
    });
  }, []);

  useEffect(() => {
    const prev = prevCarteBlancheRef.current;
    const next: Record<PlayerId, number> = {
      0: state.players[0].carteBlanchePoints,
      1: state.players[1].carteBlanchePoints,
    };
    prevCarteBlancheRef.current = next;

    for (const pid of [0, 1] as PlayerId[]) {
      if (next[pid] > prev[pid]) {
        setCarteBlancheAnnouncement({ playerId: pid, amount: next[pid] - prev[pid] });
        const timer = setTimeout(() => setCarteBlancheAnnouncement(null), CARTE_BLANCHE_ANNOUNCEMENT_MS);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [state]);

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

  // Debug/analysis view (distinct from the Tutor's single recommendation): scores EVERY
  // legal card-play with the same shared evaluator (Expert weights + card-memory risk,
  // regardless of the opponent's chosen difficulty, since this is meant to show the true
  // model's view of the position, not the current opponent's). Only meaningful for
  // playCard moves — melds/pass are covered by the meld choice list itself.
  const cardInsights: Map<string, EvaluationBreakdown> | null = useMemo(() => {
    if (!insightsEnabled || !isHumanTurn) return null;
    const playCardMoves = legalMoves.filter((m): m is Extract<Move, { type: 'playCard' }> => m.type === 'playCard');
    if (playCardMoves.length === 0) return null;
    const riskEstimator = makeCardMemoryRiskEstimator();
    const map = new Map<string, EvaluationBreakdown>();
    for (const move of playCardMoves) {
      map.set(move.cardId, evaluateMove(state, HUMAN_ID, move, EXPERT_TIER.weights, riskEstimator));
    }
    return map;
  }, [insightsEnabled, isHumanTurn, legalMoves, state]);

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
    insightsEnabled,
    setInsightsEnabled,
    cardInsights,
    carteBlancheAnnouncement,
  };
}
