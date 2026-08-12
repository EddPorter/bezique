import { describe, expect, it } from 'vitest';
import { buildDeck, deal, drawTop, makeRng, shuffle } from '../src/engine/deck.js';
import { rubiconBezique } from '../src/engine/ruleset.js';

describe('buildDeck', () => {
  it('builds 128 cards: 4 copies of each of 8 ranks in each of 4 suits', () => {
    const deck = buildDeck(rubiconBezique);
    expect(deck).toHaveLength(128);

    const bySuitRank = new Map<string, number>();
    for (const card of deck) {
      const key = `${card.suit}${card.rank}`;
      bySuitRank.set(key, (bySuitRank.get(key) ?? 0) + 1);
    }
    expect(bySuitRank.size).toBe(32);
    for (const count of bySuitRank.values()) {
      expect(count).toBe(4);
    }
  });

  it('gives every card a unique id', () => {
    const deck = buildDeck(rubiconBezique);
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(128);
  });
});

describe('shuffle', () => {
  it('is deterministic for a given seed and preserves the card set', () => {
    const deck = buildDeck(rubiconBezique);
    const shuffled1 = shuffle(deck, makeRng(42));
    const shuffled2 = shuffle(deck, makeRng(42));
    expect(shuffled1.map((c) => c.id)).toEqual(shuffled2.map((c) => c.id));

    const originalIds = new Set(deck.map((c) => c.id));
    const shuffledIds = new Set(shuffled1.map((c) => c.id));
    expect(shuffledIds).toEqual(originalIds);
  });

  it('does not mutate the input array', () => {
    const deck = buildDeck(rubiconBezique);
    const before = deck.map((c) => c.id);
    shuffle(deck, makeRng(1));
    expect(deck.map((c) => c.id)).toEqual(before);
  });

  it('actually reorders (overwhelmingly likely for 128 cards)', () => {
    const deck = buildDeck(rubiconBezique);
    const shuffled = shuffle(deck, makeRng(7));
    expect(shuffled.map((c) => c.id)).not.toEqual(deck.map((c) => c.id));
  });
});

describe('deal', () => {
  it('deals 9 cards to each player and leaves the rest as stock', () => {
    const deck = shuffle(buildDeck(rubiconBezique), makeRng(1));
    const { hands, stock } = deal(deck, rubiconBezique, 0);
    expect(hands[0]).toHaveLength(9);
    expect(hands[1]).toHaveLength(9);
    expect(stock).toHaveLength(128 - 18);
  });

  it('deals every card to exactly one place, with none duplicated or lost', () => {
    const deck = shuffle(buildDeck(rubiconBezique), makeRng(2));
    const { hands, stock } = deal(deck, rubiconBezique, 1);
    const allIds = [...hands[0], ...hands[1], ...stock].map((c) => c.id);
    expect(new Set(allIds).size).toBe(128);
  });

  it('alternates dealing starting with the non-dealer', () => {
    const deck = buildDeck(rubiconBezique); // unshuffled, so order is predictable
    const { hands } = deal(deck, rubiconBezique, 0);
    // non-dealer (player 1) should get deck[0], dealer (player 0) deck[1], etc.
    expect(hands[1]![0]!.id).toBe(deck[0]!.id);
    expect(hands[0]![0]!.id).toBe(deck[1]!.id);
  });
});

describe('drawTop', () => {
  it('takes the first card and returns the rest', () => {
    const deck = buildDeck(rubiconBezique);
    const { card, remaining } = drawTop(deck);
    expect(card!.id).toBe(deck[0]!.id);
    expect(remaining).toHaveLength(deck.length - 1);
  });

  it('returns undefined when the stock is empty', () => {
    const { card, remaining } = drawTop([]);
    expect(card).toBeUndefined();
    expect(remaining).toHaveLength(0);
  });
});
