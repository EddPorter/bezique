import type { Move } from '../engine/types.js';
import type { Agent } from './types.js';

/**
 * Bridges the Agent interface to UI clicks. `chooseMove` returns a promise
 * that stays pending until the UI calls `provideMove` with the card/meld the
 * player clicked — the UI never decides legality itself, it just offers
 * whatever `getLegalMoves` already computed.
 */
export class HumanAgent implements Agent {
  private resolve: ((move: Move) => void) | null = null;

  chooseMove(): Promise<Move> {
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  provideMove(move: Move): void {
    if (!this.resolve) {
      throw new Error('HumanAgent.provideMove called with no pending chooseMove()');
    }
    const resolve = this.resolve;
    this.resolve = null;
    resolve(move);
  }

  get isAwaitingMove(): boolean {
    return this.resolve !== null;
  }
}
