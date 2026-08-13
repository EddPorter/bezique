import type { GameState, Move } from '../engine/types.js';
import type { Agent } from './types.js';

/**
 * Bridges the Agent interface to UI clicks. `chooseMove` returns a promise
 * that stays pending until the UI calls `provideMove` with the card/meld the
 * player clicked — the UI never decides legality itself, it just offers
 * whatever `getLegalMoves` already computed.
 *
 * When there's only one legal move, it isn't a real decision — most commonly
 * a meld window where nothing is declarable, so "Pass" is the only option,
 * but the same applies to any forced single card (e.g. an endgame follow
 * constrained to exactly one legal card). Resolve it immediately instead of
 * making the player click through a choice that isn't one.
 */
export class HumanAgent implements Agent {
  private resolve: ((move: Move) => void) | null = null;

  chooseMove(_state: GameState, legalMoves: Move[]): Promise<Move> {
    if (legalMoves.length === 1) {
      return Promise.resolve(legalMoves[0]!);
    }
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
