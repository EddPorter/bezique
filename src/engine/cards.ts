import type { Card, Rank, Suit } from './types.js';

/** High to low, per rules spec §1. The 10 ranks second, just below the Ace. */
const RANK_ORDER: readonly Rank[] = ['A', '10', 'K', 'Q', 'J', '9', '8', '7'];

export function rankValue(rank: Rank): number {
  const index = RANK_ORDER.indexOf(rank);
  return RANK_ORDER.length - index;
}

export function isCourtCard(rank: Rank): boolean {
  return rank === 'J' || rank === 'Q' || rank === 'K' || rank === 'A';
}

export function cardKey(suit: Card['suit'], rank: Rank): string {
  return `${suit}${rank}`;
}

/** Inverse of the `${suit}${rank}-${copy}` id format assigned in deck.ts's buildDeck. */
export function parseCardId(id: string): { suit: Suit; rank: Rank } {
  const dashIndex = id.indexOf('-');
  const suitRank = dashIndex === -1 ? id : id.slice(0, dashIndex);
  const suit = suitRank.slice(0, 1) as Suit;
  const rank = suitRank.slice(1) as Rank;
  return { suit, rank };
}

export function findCard(cards: Card[], cardId: string): Card | undefined {
  return cards.find((c) => c.id === cardId);
}

/** Rules spec §3: dealt/held a hand with no court card (J/Q/K/A) at all. */
export function hasCarteBlanche(hand: Card[]): boolean {
  return hand.length > 0 && hand.every((c) => !isCourtCard(c.rank));
}

export function removeCard(cards: Card[], cardId: string): Card[] {
  const index = cards.findIndex((c) => c.id === cardId);
  if (index === -1) {
    throw new Error(`Card ${cardId} not found`);
  }
  return [...cards.slice(0, index), ...cards.slice(index + 1)];
}
