import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { evaluateMove, makeCardMemoryRiskEstimator, type EvaluationBreakdown } from '../agents/evaluation.js';
import { HumanAgent } from '../agents/humanAgent.js';
import { getTutorAdvice, type TutorAdvice } from '../agents/tutor.js';
import type { Agent } from '../agents/types.js';
import { CLUB_PLAYER_TIER, EXPERT_TIER, WeightedAgent, type TierConfig } from '../agents/weightedAgent.js';
import {
  applyMove,
  dealNewHand,
  finalizeMatchDeal,
  finalizeScoring,
  findCard,
  getLegalMoves,
  makeDebugState,
  makeRng,
  resolveTrick,
  startMatch,
  startNextMatchDeal,
  type MatchState,
} from '../engine/index.js';
import { OTHER_PLAYER, type Card, type GameState, type Move, type PlayerId } from '../engine/types.js';
import { AI_ID, HUMAN_ID } from './playerIds.js';
import { VARIANTS, type VariantOption } from './variants.js';

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
 * Which kind of "session" is running, mirroring `Ruleset.matchMode` (docs/classic-bezique-
 * rules-spec.md §5): `singleHand` (Rubicon/Chinese Bezique) holds a bare `GameState` — each
 * deal IS the whole game. `match` (Classic Bezique) holds a `MatchState`, whose own `.deal`
 * is the in-progress `GameState` — there's a running score across multiple deals above it.
 * Kept as a union (not two parallel pieces of state) so there's exactly one source of truth
 * for "the current deal" at all times, regardless of which ruleset is active.
 */
type Session = { mode: 'singleHand'; state: GameState } | { mode: 'match'; match: MatchState };

function startSession(ruleset: VariantOption['ruleset'], dealerId: PlayerId): Session {
  return ruleset.matchMode.kind === 'cumulativeToTarget'
    ? { mode: 'match', match: startMatch(ruleset, dealerId, makeRng(Date.now())) }
    : { mode: 'singleHand', state: dealNewHand(ruleset, dealerId, makeRng(Date.now())) };
}

function currentDeal(session: Session): GameState {
  return session.mode === 'match' ? session.match.deal : session.state;
}

/** Replaces just the in-progress deal, preserving match scores/dealer/winner untouched. */
function withDeal(session: Session, updater: (deal: GameState) => GameState): Session {
  return session.mode === 'match'
    ? { ...session, match: { ...session.match, deal: updater(session.match.deal) } }
    : { ...session, state: updater(session.state) };
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
  const [insightsEnabled, setInsightsEnabled] = useState(false);
  const agentsRef = useRef<[Agent, Agent]>([humanAgent, new WeightedAgent(AI_ID, aiTier)]);

  // The opponent can change tier mid-session (no persistence yet — that's step 8); keep the
  // agent instance in sync via a ref so the game-loop effect below always sees the latest one
  // without needing `aiTier` in its own dependency array.
  useEffect(() => {
    agentsRef.current[1] = new WeightedAgent(AI_ID, aiTier);
  }, [aiTier]);

  const [variant, setVariant] = useState<VariantOption>(VARIANTS[0]!);
  const [session, setSession] = useState<Session>(() => startSession(variant.ruleset, AI_ID));
  const state = currentDeal(session);
  const [completedTrick, setCompletedTrick] = useState<CompletedTrick | null>(null);

  // Carte blanche (rules spec §3) is auto-detected and scored directly rather than modeled
  // as a persistent meld (see docs/PROJECT-BRIEF.md) — which means, without this, it was
  // completely silent: a real 50-point jump with no meld record and no announcement to
  // explain it. Tracks the last-seen total per player so a genuine increase (initial deal,
  // or any later draw that still has zero court cards) can be announced.
  const prevCarteBlancheRef = useRef<Record<PlayerId, number>>({ 0: 0, 1: 0 });
  const [carteBlancheAnnouncement, setCarteBlancheAnnouncement] = useState<CarteBlancheAnnouncement | null>(null);

  /** Full reset: fresh match/game at 0-0 (or a fresh single deal), dealer alternated from
   * whoever last dealt. Used by "New Game" and a variant switch — either discards whatever
   * match/hand was in progress. */
  const startNewHand = useCallback(() => {
    setCompletedTrick(null);
    setCarteBlancheAnnouncement(null);
    prevCarteBlancheRef.current = { 0: 0, 1: 0 };
    setSession((prev) => {
      const nextDealer: PlayerId = OTHER_PLAYER[currentDeal(prev).dealerId];
      return startSession(variant.ruleset, nextDealer);
    });
  }, [variant]);

  /** Classic Bezique only: deals the next hand of an ONGOING match, carrying the running
   * score forward — distinct from startNewHand, which resets the score to 0-0. A no-op if
   * called outside match mode or after the match already has a winner. */
  const startNextDeal = useCallback(() => {
    setCompletedTrick(null);
    setCarteBlancheAnnouncement(null);
    prevCarteBlancheRef.current = { 0: 0, 1: 0 };
    setSession((prev) =>
      prev.mode === 'match' ? { mode: 'match', match: startNextMatchDeal(prev.match, makeRng(Date.now())) } : prev,
    );
  }, []);

  // Switching variants always starts a fresh deal under the new ruleset — a mid-hand
  // ruleset swap doesn't mean anything (different deck size, meld table, scoring numbers).
  const changeVariant = useCallback((next: VariantOption) => {
    setVariant(next);
    setCompletedTrick(null);
    setCarteBlancheAnnouncement(null);
    prevCarteBlancheRef.current = { 0: 0, 1: 0 };
    setSession((prev) => {
      const nextDealer: PlayerId = OTHER_PLAYER[currentDeal(prev).dealerId];
      return startSession(next.ruleset, nextDealer);
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

  // Dev-only debug bridge (docs/ideas-backlog.md #2/#3): exposes the live GameState on
  // window.__bezique so it can be dumped or overwritten directly from the browser console
  // or an automated script, instead of clicking/playing up to a specific scenario. GameState
  // is plain, serializable data (no class instances, no functions), so getState()'s result
  // round-trips through JSON.stringify/parse cleanly, and setState() jumps the running game
  // straight to whatever was passed in — the game loop effect below picks it up on the next
  // render exactly as if it had been reached by play. In match mode, setState only replaces
  // the in-progress deal; match.scores/dealerId/winnerId are left as they were. Stripped from
  // production builds since `import.meta.env.DEV` is statically false there.
  //
  // Example (browser console): window.__bezique.setState(window.__bezique.makeDebugState({
  //   turn: window.__bezique.HUMAN_ID,
  //   trumpSuit: 'H',
  //   players: [
  //     { id: 0, hand: [{ id: 'HK-0', suit: 'H', rank: 'K' }, { id: 'HQ-0', suit: 'H', rank: 'Q' }], melds: [], score: 0, carteBlanchePoints: 0 },
  //     { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
  //   ],
  // }))
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __bezique: unknown }).__bezique = {
      getState: () => state,
      setState: (next: GameState) => setSession((prev) => withDeal(prev, () => next)),
      makeDebugState,
      HUMAN_ID,
      AI_ID,
    };
  }, [state]);

  useEffect(() => {
    if (state.phase === 'scoring') {
      setSession((prev) => {
        if (currentDeal(prev) !== state) return prev;
        return prev.mode === 'match'
          ? { mode: 'match', match: finalizeMatchDeal(prev.match) }
          : { mode: 'singleHand', state: finalizeScoring(prev.state) };
      });
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
          setSession((prev) => withDeal(prev, (current) => (current === state ? applyMove(current, move) : current)));
        }, TRICK_PAUSE_MS);
        return;
      }

      setSession((prev) => withDeal(prev, (current) => (current === state ? applyMove(current, move) : current)));
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
    // Classic Bezique only (docs/classic-bezique-rules-spec.md §5): null for
    // singleHandComplete rulesets, where a deal IS the whole game.
    match: session.mode === 'match' ? session.match : null,
    startNextDeal,
  };
}
