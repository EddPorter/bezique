import type { GameState, Move } from '../engine/types.js';

/** Architecture plan §5: human, AI tiers, and the tutor all share this one interface. */
export interface Agent {
  chooseMove(state: GameState, legalMoves: Move[]): Promise<Move>;
}
