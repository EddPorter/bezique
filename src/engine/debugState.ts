import { rubiconBezique } from './ruleset.js';
import type { GameState } from './types.js';

/**
 * Builds a full, valid GameState from a partial description, defaulting
 * everything else to an empty/neutral starting point — the same pattern
 * every test file in test/ hand-rolls locally. Exported so it can also back
 * a dev-only debug bridge (see useGame.ts) for reconstructing a specific
 * scenario directly in the browser instead of playing up to it.
 */
export function makeDebugState(overrides: Partial<GameState> = {}): GameState {
  const base: GameState = {
    ruleset: rubiconBezique,
    deck: [],
    players: [
      { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
    ],
    trumpSuit: null,
    phase: 'main',
    stage: 'awaitingLead',
    currentTrick: { leaderId: 0, leadCard: null },
    tricksWon: { 0: [], 1: [] },
    cardMeldClassUsage: {},
    turn: 0,
    dealerId: 1,
    lastTrickWinnerId: null,
    history: [],
  };
  return { ...base, ...overrides };
}
