import { describe, expect, it } from 'vitest';
import { dealNewHand } from '../src/engine/state.js';
import { makeRng } from '../src/engine/deck.js';
import { rubiconBezique } from '../src/engine/ruleset.js';
import type { Ruleset } from '../src/engine/types.js';

describe('dealNewHand: trumpDetermination', () => {
  it('firstMarriageOrSequence rulesets (Rubicon Bezique) start with trumps undetermined and no turn-up card', () => {
    const state = dealNewHand(rubiconBezique, 1, makeRng(1));
    expect(state.trumpSuit).toBeNull();
    expect(state.turnUpCard).toBeNull();
    const fullDeckSize = rubiconBezique.deckCopies * rubiconBezique.suits.length * rubiconBezique.ranks.length;
    expect(state.deck).toHaveLength(fullDeckSize - 2 * rubiconBezique.cardsPerPlayer);
  });

  it('turnedUpCard rulesets set trumps immediately from a card pulled off the top of the stock', () => {
    const turnedUpRuleset: Ruleset = { ...rubiconBezique, trumpDetermination: 'turnedUpCard' };
    const state = dealNewHand(turnedUpRuleset, 1, makeRng(1));

    expect(state.turnUpCard).not.toBeNull();
    expect(state.trumpSuit).toBe(state.turnUpCard!.suit);

    // The turn-up card is neither drawable stock nor in either hand.
    const fullDeckSize = turnedUpRuleset.deckCopies * turnedUpRuleset.suits.length * turnedUpRuleset.ranks.length;
    const dealtCards = 2 * turnedUpRuleset.cardsPerPlayer;
    expect(state.deck).toHaveLength(fullDeckSize - dealtCards - 1);
    expect(state.deck.find((card) => card.id === state.turnUpCard!.id)).toBeUndefined();
    for (const player of state.players) {
      expect(player.hand.find((card) => card.id === state.turnUpCard!.id)).toBeUndefined();
    }
  });
});
