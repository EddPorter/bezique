import type { Ruleset } from './types.js';

/**
 * Classic (plain) Bezique config, per docs/classic-bezique-rules-spec.md — the base game
 * both Rubicon and Chinese Bezique are built on, not a variant of either. Structurally
 * different in several real ways, not just numbers: trumps are set by a turned-up card at
 * the deal (not the first marriage/sequence), the dix scores, the endgame has no forced-win
 * rule, brisques count every deal unconditionally, and a match runs across multiple deals to
 * a target score rather than each deal being a complete game on its own.
 */
export const classicBezique: Ruleset = {
  deckCopies: 2,
  cardsPerPlayer: 8,
  ranks: ['A', '10', 'K', 'Q', 'J', '9', '8', '7'],
  suits: ['S', 'H', 'D', 'C'],
  lastTrickBonus: 10,
  brisqueValue: 10,
  // Neither source's scoring table mentions carte blanche at all — Hoyle's table (§6) is an
  // otherwise exhaustive list of every scoring event, so its absence reads as "not part of
  // this variant" rather than an oversight worth guessing a figure for.
  carteBlanchePoints: 0,
  trumpDetermination: 'turnedUpCard',
  endgameMustWinIfAble: false,
  brisquesAlwaysCount: true,
  dix: { points: 10 },
  matchMode: {
    kind: 'cumulativeToTarget',
    targetScore: 1000,
  },
  meldTable: {
    marriage: { class: 'sequence', classRank: 0, requiredCount: 2, trumpPoints: 40, plainPoints: 20 },
    // trumpOnly: no plain-suit Sequence exists at all in this variant (§6) — plainPoints is
    // required by the type but never read once trumpOnly is set.
    sequence: { class: 'sequence', classRank: 1, requiredCount: 5, trumpPoints: 250, plainPoints: 0, trumpOnly: true },
    bezique: { class: 'bezique', classRank: 0, requiredCount: 2, points: 40 },
    // Ceiling, not an omission: only 2 combined packs means only 2 copies each of Q♠/J♦ ever
    // exist, so Double Bezique (500) is the highest tier possible — no Triple/Quadruple.
    doubleBezique: { class: 'bezique', classRank: 1, requiredCount: 4, points: 500 },
    fourAces: { class: 'quartet', classRank: 0, requiredCount: 4, points: 100 },
    fourKings: { class: 'quartet', classRank: 0, requiredCount: 4, points: 80 },
    fourQueens: { class: 'quartet', classRank: 0, requiredCount: 4, points: 60 },
    fourJacks: { class: 'quartet', classRank: 0, requiredCount: 4, points: 40 },
  },
};
