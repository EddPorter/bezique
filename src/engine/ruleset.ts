import type { Ruleset } from './types.js';

/**
 * Rubicon Bezique config, per docs/bezique-rules-spec.md.
 * Kept as data (not hard-coded engine logic) so a second variant can be added
 * as a new ruleset later, and so the help sheet can be generated from it (§6/§7).
 */
export const rubiconBezique: Ruleset = {
  deckCopies: 4,
  cardsPerPlayer: 9,
  ranks: ['A', '10', 'K', 'Q', 'J', '9', '8', '7'],
  suits: ['S', 'H', 'D', 'C'],
  rubiconThreshold: 1000,
  gameBonus: 500,
  lastTrickBonus: 50,
  brisqueValue: 10,
  roundTo: 100,
  carteBlanchePoints: 50,
  meldTable: {
    marriage: { class: 'sequence', classRank: 0, requiredCount: 2, trumpPoints: 40, plainPoints: 20 },
    sequence: { class: 'sequence', classRank: 1, requiredCount: 5, trumpPoints: 250, plainPoints: 150 },
    bezique: { class: 'bezique', classRank: 0, requiredCount: 2, points: 40 },
    doubleBezique: { class: 'bezique', classRank: 1, requiredCount: 4, points: 500 },
    tripleBezique: { class: 'bezique', classRank: 2, requiredCount: 6, points: 1500 },
    quadrupleBezique: { class: 'bezique', classRank: 3, requiredCount: 8, points: 4500 },
    fourAces: { class: 'quartet', classRank: 0, requiredCount: 4, points: 100 },
    fourKings: { class: 'quartet', classRank: 0, requiredCount: 4, points: 80 },
    fourQueens: { class: 'quartet', classRank: 0, requiredCount: 4, points: 60 },
    fourJacks: { class: 'quartet', classRank: 0, requiredCount: 4, points: 40 },
  },
};
