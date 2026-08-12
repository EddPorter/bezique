import { useCallback, useEffect, useRef, useState } from 'react';
import { ClubPlayerAgent } from '../agents/clubPlayerAgent.js';
import { HumanAgent } from '../agents/humanAgent.js';
import type { Agent } from '../agents/types.js';
import { applyMove, dealNewHand, finalizeScoring, getLegalMoves, makeRng, rubiconBezique } from '../engine/index.js';
import type { GameState, Move, PlayerId } from '../engine/types.js';
import { AI_ID, HUMAN_ID } from './playerIds.js';

/**
 * Drives the game loop through the same Agent interface for both players
 * (architecture plan §5): whichever player owns the current turn gets asked
 * via `chooseMove`. The human agent's promise just stays pending until the
 * UI calls `submitMove`; the AI resolves on its own after a short "thinking" delay.
 */
export function useGame() {
  const humanAgent = useRef(new HumanAgent()).current;
  const aiAgent = useRef(new ClubPlayerAgent(AI_ID)).current;
  const agents = useRef<[Agent, Agent]>([humanAgent, aiAgent]).current;

  const [state, setState] = useState<GameState>(() => dealNewHand(rubiconBezique, AI_ID, makeRng(Date.now())));

  const startNewHand = useCallback(() => {
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
    agents[state.turn].chooseMove(state, legalMoves).then((move) => {
      if (cancelled) return;
      setState((current) => (current === state ? applyMove(current, move) : current));
    });
    return () => {
      cancelled = true;
    };
  }, [state]);

  // Derived purely from `state` (reactive) rather than the agent's internal ref field
  // (mutating that field doesn't itself trigger a re-render, so it can't drive the UI).
  const isHumanTurn = state.turn === HUMAN_ID && state.phase !== 'scoring' && state.phase !== 'complete';
  const legalMoves: Move[] = isHumanTurn ? getLegalMoves(state, HUMAN_ID) : [];

  const submitMove = useCallback(
    (move: Move) => {
      if (state.turn !== HUMAN_ID || !humanAgent.isAwaitingMove) return;
      humanAgent.provideMove(move);
    },
    [state, humanAgent],
  );

  return { state, legalMoves, submitMove, startNewHand, isHumanTurn };
}
