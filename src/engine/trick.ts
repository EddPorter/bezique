import { rankValue } from './cards.js';
import type { Card, PlayerId, Suit } from './types.js';

/**
 * Rules spec §4: in the endgame, the follower must follow suit if able, and
 * must win the trick if able (trumping if void in the led suit and unable to
 * win any other way). Returns the subset of `hand` that are legal follows.
 */
export function endgameLegalFollowCards(hand: Card[], leadCard: Card, trumpSuit: Suit | null): Card[] {
  const sameSuit = hand.filter((c) => c.suit === leadCard.suit);
  if (sameSuit.length > 0) {
    const winners = sameSuit.filter((c) => rankValue(c.rank) > rankValue(leadCard.rank));
    return winners.length > 0 ? winners : sameSuit;
  }
  if (trumpSuit !== null) {
    const trumps = hand.filter((c) => c.suit === trumpSuit);
    if (trumps.length > 0) return trumps;
  }
  return hand;
}

/**
 * Rules spec §2.3-4: trick won by the higher card of the suit led, or by any
 * trump if the second card is a trump and the lead wasn't. Identical cards:
 * the one played first (the lead) wins. `trumpSuit` may be null before the
 * first marriage/sequence of the hand is declared — then only suit-led
 * comparisons apply.
 */
export function resolveTrick(
  leadCard: Card,
  leadPlayerId: PlayerId,
  followCard: Card,
  followPlayerId: PlayerId,
  trumpSuit: Suit | null,
): PlayerId {
  if (followCard.suit === leadCard.suit) {
    return rankValue(followCard.rank) > rankValue(leadCard.rank) ? followPlayerId : leadPlayerId;
  }
  if (trumpSuit !== null && followCard.suit === trumpSuit) {
    return followPlayerId;
  }
  return leadPlayerId;
}
