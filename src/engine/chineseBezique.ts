import type { Ruleset } from './types.js';

/**
 * Chinese (Six-Pack) Bezique config, per docs/chinese-bezique-rules-spec.md.
 * "Played the same way as Rubicon Bezique except for these rules changes" — Pagat's
 * "Bezique and Variations" (archived from Howard Fosdick, revised by John McLeod), the
 * same source already cited for Rubicon Bezique's own spec. See the doc for exactly
 * which values below are directly sourced vs. inferred (game bonus, brisque value, and
 * round-to aren't mentioned as different, so are carried over from Rubicon Bezique).
 */
export const chineseBezique: Ruleset = {
  deckCopies: 6,
  cardsPerPlayer: 12,
  ranks: ['A', '10', 'K', 'Q', 'J', '9', '8', '7'],
  suits: ['S', 'H', 'D', 'C'],
  rubiconThreshold: 3000,
  gameBonus: 500,
  rubiconBonus: 1000,
  lastTrickBonus: 250,
  brisqueValue: 10,
  roundTo: 100,
  carteBlanchePoints: 250,
  meldTable: {
    marriage: { class: 'sequence', classRank: 0, requiredCount: 2, trumpPoints: 40, plainPoints: 20 },
    sequence: { class: 'sequence', classRank: 1, requiredCount: 5, trumpPoints: 250, plainPoints: 150 },
    bezique: { class: 'bezique', classRank: 0, requiredCount: 2, points: 40 },
    doubleBezique: { class: 'bezique', classRank: 1, requiredCount: 4, points: 500 },
    tripleBezique: { class: 'bezique', classRank: 2, requiredCount: 6, points: 1500 },
    // Ceiling, not a typo: the source is explicit that there is no separate score for
    // quintuple or sextuple Bezique even though 6 decks make up to 6 pairs possible.
    quadrupleBezique: { class: 'bezique', classRank: 3, requiredCount: 8, points: 4500 },
    fourAces: { class: 'quartet', classRank: 0, requiredCount: 4, points: 100 },
    fourKings: { class: 'quartet', classRank: 0, requiredCount: 4, points: 80 },
    fourQueens: { class: 'quartet', classRank: 0, requiredCount: 4, points: 60 },
    fourJacks: { class: 'quartet', classRank: 0, requiredCount: 4, points: 40 },
    // "Additional declarations" per the source — four copies of the SAME card, all in the
    // trump suit. classRank 1 (one above the plain quartets' 0) so a card already scored in
    // the plain quartet can be reused upward into the trump quartet, never the reverse —
    // inferred from the class-reuse pattern already established elsewhere (not itself a
    // cited Law for Chinese Bezique specifically), matching the source's own strategy note
    // about "converting" a 4-of-a-kind to trumps for extra score. See the rules-spec doc.
    fourTrumpAces: { class: 'quartet', classRank: 1, requiredCount: 4, points: 1000, suitScope: 'trump' },
    fourTrumpTens: { class: 'quartet', classRank: 1, requiredCount: 4, points: 900, suitScope: 'trump' },
    fourTrumpKings: { class: 'quartet', classRank: 1, requiredCount: 4, points: 800, suitScope: 'trump' },
    fourTrumpQueens: { class: 'quartet', classRank: 1, requiredCount: 4, points: 600, suitScope: 'trump' },
    fourTrumpJacks: { class: 'quartet', classRank: 1, requiredCount: 4, points: 400, suitScope: 'trump' },
  },
};
