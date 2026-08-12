import type { Card, PlayerId, Ruleset } from './types.js';

export type Rng = () => number;

/** Deterministic PRNG (mulberry32) so games/tests can be seeded and replayed. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds the full pack: `deckCopies` combined 32-card decks, e.g. 4×32 = 128 cards. */
export function buildDeck(ruleset: Ruleset): Card[] {
  const cards: Card[] = [];
  for (const suit of ruleset.suits) {
    for (const rank of ruleset.ranks) {
      for (let copy = 0; copy < ruleset.deckCopies; copy++) {
        cards.push({ id: `${suit}${rank}-${copy}`, suit, rank });
      }
    }
  }
  return cards;
}

/** Fisher-Yates. Pure — returns a new array, does not mutate `cards`. */
export function shuffle(cards: Card[], rng: Rng): Card[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const iCard = result[i]!;
    const jCard = result[j]!;
    result[i] = jCard;
    result[j] = iCard;
  }
  return result;
}

export interface DealResult {
  hands: Record<PlayerId, Card[]>;
  stock: Card[];
}

/**
 * Deals `cardsPerPlayer` to each player, alternating one card at a time
 * starting with the non-dealer, per convention (the spec fixes the count
 * and that no card is turned up, not the dealing mechanics).
 * `deck[0]` is the top of the pack throughout — drawing takes from index 0.
 */
export function deal(deck: Card[], ruleset: Ruleset, dealerId: PlayerId): DealResult {
  const nonDealerId: PlayerId = dealerId === 0 ? 1 : 0;
  const hands: Record<PlayerId, Card[]> = { 0: [], 1: [] };
  let cursor = 0;
  for (let i = 0; i < ruleset.cardsPerPlayer; i++) {
    hands[nonDealerId]!.push(deck[cursor++]!);
    hands[dealerId]!.push(deck[cursor++]!);
  }
  return { hands, stock: deck.slice(cursor) };
}

export function drawTop(stock: Card[]): { card: Card | undefined; remaining: Card[] } {
  return { card: stock[0], remaining: stock.slice(1) };
}
