import { parseCardId } from './cards.js';
import type { Card, MeldClass, MeldDeclaration, MeldDef, MeldKind, Rank, Ruleset, Suit } from './types.js';

interface Slot {
  suit: Suit;
  rank: Rank;
}

function repeatSlots(slots: Slot[], times: number): Slot[] {
  return Array.from({ length: times }, () => slots).flat();
}

/** The exact (suit, rank) requirements for a meld kind, per rules spec §3's meld table. */
export function requiredSlots(ruleset: Ruleset, kind: MeldKind, suit?: Suit): Slot[] {
  switch (kind) {
    case 'marriage':
      return [
        { suit: suit!, rank: 'K' },
        { suit: suit!, rank: 'Q' },
      ];
    case 'sequence':
      return (['A', '10', 'K', 'Q', 'J'] as const).map((rank) => ({ suit: suit!, rank }));
    case 'bezique':
      return repeatSlots([{ suit: 'S', rank: 'Q' }, { suit: 'D', rank: 'J' }], 1);
    case 'doubleBezique':
      return repeatSlots([{ suit: 'S', rank: 'Q' }, { suit: 'D', rank: 'J' }], 2);
    case 'tripleBezique':
      return repeatSlots([{ suit: 'S', rank: 'Q' }, { suit: 'D', rank: 'J' }], 3);
    case 'quadrupleBezique':
      return repeatSlots([{ suit: 'S', rank: 'Q' }, { suit: 'D', rank: 'J' }], 4);
    case 'fourAces':
      return ruleset.suits.map((s) => ({ suit: s, rank: 'A' as Rank }));
    case 'fourKings':
      return ruleset.suits.map((s) => ({ suit: s, rank: 'K' as Rank }));
    case 'fourQueens':
      return ruleset.suits.map((s) => ({ suit: s, rank: 'Q' as Rank }));
    case 'fourJacks':
      return ruleset.suits.map((s) => ({ suit: s, rank: 'J' as Rank }));
  }
}

export function meldPoints(def: MeldDef, meldSuit: Suit | undefined, trumpSuit: Suit | null): number {
  if (def.class === 'sequence') {
    return meldSuit !== undefined && meldSuit === trumpSuit ? def.trumpPoints : def.plainPoints;
  }
  return def.points;
}

function slotKey(slot: Slot): string {
  return `${slot.suit}${slot.rank}`;
}

/** Groups hand cards by suit+rank so slot requirements can be matched against available duplicates. */
function groupBySuitRank(hand: Card[]): Map<string, Card[]> {
  const map = new Map<string, Card[]>();
  for (const card of hand) {
    const key = `${card.suit}${card.rank}`;
    const list = map.get(key);
    if (list) list.push(card);
    else map.set(key, [card]);
  }
  return map;
}

export interface DeclarableMeld {
  kind: MeldKind;
  class: MeldClass;
  suit?: Suit;
  cardIds: string[];
  points: number;
  isReplacement: boolean;
  /** id of the existing MeldDeclaration this reconstructs, when isReplacement is true */
  replacesMeldId?: string;
}

/**
 * Fresh (non-replacement) meld options declarable right now from the player's hand,
 * respecting the same-class reuse rule (rules spec §3, Portland Club Laws 36-38):
 * a card already scored in a class can move UP to a superior combination of that
 * class, but can never move back DOWN to an inferior one. It remains free to use
 * in other classes entirely, or (separately) in a replacement re-declaration.
 */
export function findFreshDeclarableMelds(
  ruleset: Ruleset,
  hand: Card[],
  trumpSuit: Suit | null,
  cardMeldClassUsage: Record<string, Partial<Record<MeldClass, number>>>,
): DeclarableMeld[] {
  const bySuitRank = groupBySuitRank(hand);
  const results: DeclarableMeld[] = [];

  const tryKind = (kind: MeldKind, suit: Suit | undefined) => {
    const def = ruleset.meldTable[kind];
    const slots = requiredSlots(ruleset, kind, suit);
    const usedCardIds = new Set<string>();
    const chosen: string[] = [];

    for (const slot of slots) {
      const candidates = (bySuitRank.get(slotKey(slot)) ?? []).filter((c) => {
        if (usedCardIds.has(c.id)) return false;
        const highestRankScored = cardMeldClassUsage[c.id]?.[def.class];
        // Strictly greater, not >=: a card already scored at this exact rank means the
        // exact same kind (rank uniquely determines kind within a class in this ruleset),
        // and re-declaring the identical still-standing combination isn't an "upgrade" —
        // that's what the replacement mechanic is for, after the meld has been broken.
        return highestRankScored === undefined || def.classRank > highestRankScored;
      });
      const pick = candidates[0];
      if (!pick) return; // can't fill this slot without downgrading a card or reusing an already-chosen one
      usedCardIds.add(pick.id);
      chosen.push(pick.id);
    }

    results.push({
      kind,
      class: def.class,
      suit,
      cardIds: chosen,
      points: meldPoints(def, suit, trumpSuit),
      isReplacement: false,
    });
  };

  for (const suit of ruleset.suits) {
    tryKind('marriage', suit);
    tryKind('sequence', suit);
  }
  tryKind('bezique', undefined);
  tryKind('doubleBezique', undefined);
  tryKind('tripleBezique', undefined);
  tryKind('quadrupleBezique', undefined);
  tryKind('fourAces', undefined);
  tryKind('fourKings', undefined);
  tryKind('fourQueens', undefined);
  tryKind('fourJacks', undefined);

  return results;
}

function isInHand(hand: Card[], cardId: string): boolean {
  return hand.some((c) => c.id === cardId);
}

/**
 * Replacement re-declarations (rules spec §3): once part of a declared meld has
 * been played away, the player may reconstruct that SAME combination using a
 * spare card of matching suit/rank currently doing duty in another declared
 * meld, re-scoring it without a fresh card from hand.
 */
export function findReplacementRedeclarations(
  ruleset: Ruleset,
  hand: Card[],
  existingMelds: MeldDeclaration[],
  trumpSuit: Suit | null,
): DeclarableMeld[] {
  const results: DeclarableMeld[] = [];

  for (const meld of existingMelds) {
    const missingCardIds = meld.cardIds.filter((id) => !isInHand(hand, id));
    if (missingCardIds.length === 0) continue; // still standing, nothing to replace

    const missingSlots = missingCardIds.map((id) => parseCardId(id));
    const usedAsSpare = new Set<string>();
    const reconstructed: string[] = meld.cardIds.filter((id) => isInHand(hand, id));
    let ok = true;

    for (const slot of missingSlots) {
      // Rules spec §3: the substitute may be "either a fresh one from hand, or one
      // borrowed from another standing meld" — any hand card of the right suit/rank
      // qualifies, not only ones already committed to a different declared meld.
      const spare = hand.find(
        (c) => c.suit === slot.suit && c.rank === slot.rank && !meld.cardIds.includes(c.id) && !usedAsSpare.has(c.id),
      );
      if (!spare) {
        ok = false;
        break;
      }
      usedAsSpare.add(spare.id);
      reconstructed.push(spare.id);
    }

    if (!ok) continue;

    // Reject a reconstruction that would exactly duplicate another meld the player
    // ALREADY has fully standing (all its cards still in hand, nothing played away
    // since it was declared). The rules spec's Law 35 "reshuffle" exception (borrowing
    // a card from another standing meld) only kicks in once a card has actually been
    // played away to free it up — it never permits re-offering an untouched, still-
    // standing combination as if it were newly available again. Without this check, a
    // broken meld's spare search could "borrow" a card that's currently completing a
    // sibling standing meld and simply re-propose that exact same sibling combination.
    const duplicatesAStandingMeld = existingMelds.some(
      (other) =>
        other.id !== meld.id &&
        other.cardIds.length === reconstructed.length &&
        other.cardIds.every((id) => reconstructed.includes(id)) &&
        other.cardIds.every((id) => isInHand(hand, id)),
    );
    if (duplicatesAStandingMeld) continue;

    const def = ruleset.meldTable[meld.kind];
    results.push({
      kind: meld.kind,
      class: meld.class,
      suit: meld.suit,
      cardIds: reconstructed,
      points: meldPoints(def, meld.suit, trumpSuit),
      isReplacement: true,
      replacesMeldId: meld.id,
    });
  }

  return results;
}

export function findAllDeclarableMelds(
  ruleset: Ruleset,
  hand: Card[],
  existingMelds: MeldDeclaration[],
  trumpSuit: Suit | null,
  cardMeldClassUsage: Record<string, Partial<Record<MeldClass, number>>>,
): DeclarableMeld[] {
  return [
    ...findFreshDeclarableMelds(ruleset, hand, trumpSuit, cardMeldClassUsage),
    ...findReplacementRedeclarations(ruleset, hand, existingMelds, trumpSuit),
  ];
}
