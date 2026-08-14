import { rankValue } from '../engine/cards.js';
import type { Card, Suit } from '../engine/types.js';

const SUIT_ORDER: readonly Suit[] = ['S', 'H', 'D', 'C'];

function bySuitThenRank(a: Card, b: Card): number {
  const suitDiff = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
  if (suitDiff !== 0) return suitDiff;
  return rankValue(a.rank) - rankValue(b.rank);
}

export type HandSortMode = 'suitRank' | 'groupMelds';

export const HAND_SORT_MODES: { value: HandSortMode; label: string }[] = [
  { value: 'suitRank', label: 'Suit & rank' },
  { value: 'groupMelds', label: 'Group melds' },
];

/**
 * Display-only ordering (docs/ideas-backlog.md #1) — never touches game state or
 * legality, purely how the hand is laid out. `groupMelds` clusters currently-melded
 * cards together (each cluster still suit+rank sorted internally), followed by the
 * rest of the hand; a card can belong to more than one standing meld (rules spec §3
 * replacement re-declarations), so this groups by membership, not by which meld.
 */
export function sortHand(hand: Card[], mode: HandSortMode, meldCardIds: ReadonlySet<string>): Card[] {
  if (mode === 'suitRank') return [...hand].sort(bySuitThenRank);
  const melded = hand.filter((c) => meldCardIds.has(c.id)).sort(bySuitThenRank);
  const rest = hand.filter((c) => !meldCardIds.has(c.id)).sort(bySuitThenRank);
  return [...melded, ...rest];
}
