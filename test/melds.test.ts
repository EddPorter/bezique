import { describe, expect, it } from 'vitest';
import {
  findAllDeclarableMelds,
  findFreshDeclarableMelds,
  findReplacementRedeclarations,
} from '../src/engine/melds.js';
import { rubiconBezique } from '../src/engine/ruleset.js';
import type { Card, MeldClass, MeldDeclaration } from '../src/engine/types.js';

const c = (id: string, suit: Card['suit'], rank: Card['rank']): Card => ({ id, suit, rank });

function meld(
  overrides: Partial<MeldDeclaration> & Pick<MeldDeclaration, 'kind' | 'class' | 'cardIds'>,
): MeldDeclaration {
  return {
    id: `${overrides.kind}-${overrides.cardIds.join(',')}`,
    suit: undefined,
    points: 0,
    declaredAtMoveIndex: 0,
    lastScoredAtMoveIndex: 0,
    ...overrides,
  };
}

describe('findFreshDeclarableMelds', () => {
  it('finds a common (non-trump) marriage', () => {
    const hand = [c('SK-0', 'S', 'K'), c('SQ-0', 'S', 'Q')];
    const options = findFreshDeclarableMelds(rubiconBezique, hand, null, {});
    const marriage = options.find((o) => o.kind === 'marriage' && o.suit === 'S');
    expect(marriage).toBeDefined();
    expect(marriage!.points).toBe(20);
  });

  it('values a marriage in the trump suit at 40', () => {
    const hand = [c('SK-0', 'S', 'K'), c('SQ-0', 'S', 'Q')];
    const options = findFreshDeclarableMelds(rubiconBezique, hand, 'S', {});
    const marriage = options.find((o) => o.kind === 'marriage' && o.suit === 'S');
    expect(marriage!.points).toBe(40);
  });

  it('finds bezique (QS + JD) worth 40', () => {
    const hand = [c('SQ-0', 'S', 'Q'), c('DJ-0', 'D', 'J')];
    const options = findFreshDeclarableMelds(rubiconBezique, hand, null, {});
    const bezique = options.find((o) => o.kind === 'bezique');
    expect(bezique).toBeDefined();
    expect(bezique!.points).toBe(40);
    expect(bezique!.cardIds.sort()).toEqual(['DJ-0', 'SQ-0']);
  });

  it('does not find double bezique with only one QS/JD pair', () => {
    const hand = [c('SQ-0', 'S', 'Q'), c('DJ-0', 'D', 'J')];
    const options = findFreshDeclarableMelds(rubiconBezique, hand, null, {});
    expect(options.find((o) => o.kind === 'doubleBezique')).toBeUndefined();
  });

  it('finds double bezique worth 500 with two of each', () => {
    const hand = [
      c('SQ-0', 'S', 'Q'),
      c('SQ-1', 'S', 'Q'),
      c('DJ-0', 'D', 'J'),
      c('DJ-1', 'D', 'J'),
    ];
    const options = findFreshDeclarableMelds(rubiconBezique, hand, null, {});
    const double = options.find((o) => o.kind === 'doubleBezique');
    expect(double).toBeDefined();
    expect(double!.points).toBe(500);
    expect(double!.cardIds).toHaveLength(4);
  });

  it('finds four aces (one of each suit) worth 100', () => {
    const hand = [c('SA-0', 'S', 'A'), c('HA-0', 'H', 'A'), c('DA-0', 'D', 'A'), c('CA-0', 'C', 'A')];
    const options = findFreshDeclarableMelds(rubiconBezique, hand, null, {});
    const fourAces = options.find((o) => o.kind === 'fourAces');
    expect(fourAces!.points).toBe(100);
  });

  it('finds a non-trump sequence worth 150 and a trump sequence worth 250', () => {
    const hand = [c('SA-0', 'S', 'A'), c('S10-0', 'S', '10'), c('SK-0', 'S', 'K'), c('SQ-0', 'S', 'Q'), c('SJ-0', 'S', 'J')];
    const plain = findFreshDeclarableMelds(rubiconBezique, hand, null, {});
    expect(plain.find((o) => o.kind === 'sequence')!.points).toBe(150);
    const trump = findFreshDeclarableMelds(rubiconBezique, hand, 'S', {});
    expect(trump.find((o) => o.kind === 'sequence')!.points).toBe(250);
  });

  it('same-class reuse is blocked downward: a card scored in Sequence cannot later fill a Marriage', () => {
    // Portland Club Law 37: a card declared in a superior combination (Sequence, rank 1)
    // cannot be reused in an inferior one of the same class (Marriage, rank 0).
    const hand = [c('SK-0', 'S', 'K'), c('SQ-0', 'S', 'Q')];
    const usage: Record<string, Partial<Record<MeldClass, number>>> = { 'SK-0': { sequence: 1 } };
    const options = findFreshDeclarableMelds(rubiconBezique, hand, null, usage);
    expect(options.find((o) => o.kind === 'marriage' && o.suit === 'S')).toBeUndefined();
  });

  it('same-class reuse is allowed upward: a card scored in Marriage can later fill a Sequence', () => {
    // Law 36: a declared Marriage's King/Queen can go on to score a Sequence too.
    const hand = [c('SA-0', 'S', 'A'), c('S10-0', 'S', '10'), c('SK-0', 'S', 'K'), c('SQ-0', 'S', 'Q'), c('SJ-0', 'S', 'J')];
    const usage: Record<string, Partial<Record<MeldClass, number>>> = { 'SK-0': { sequence: 0 }, 'SQ-0': { sequence: 0 } };
    const options = findFreshDeclarableMelds(rubiconBezique, hand, null, usage);
    expect(options.find((o) => o.kind === 'sequence' && o.suit === 'S')).toBeDefined();
  });

  it('does not offer a fresh re-declaration of the exact same still-standing meld (found via manual UI testing)', () => {
    // A standing, never-broken Bezique shouldn't be re-scorable just by winning another trick —
    // that's what the replacement mechanic (after the meld is broken) is specifically for.
    const hand = [c('SQ-0', 'S', 'Q'), c('DJ-0', 'D', 'J')];
    const usage: Record<string, Partial<Record<MeldClass, number>>> = { 'SQ-0': { bezique: 0 }, 'DJ-0': { bezique: 0 } };
    const options = findFreshDeclarableMelds(rubiconBezique, hand, null, usage);
    expect(options.find((o) => o.kind === 'bezique')).toBeUndefined();
  });

  it('still allows upgrading to a higher rank in the same class (single -> double bezique)', () => {
    const hand = [c('SQ-0', 'S', 'Q'), c('SQ-1', 'S', 'Q'), c('DJ-0', 'D', 'J'), c('DJ-1', 'D', 'J')];
    const usage: Record<string, Partial<Record<MeldClass, number>>> = { 'SQ-0': { bezique: 0 }, 'DJ-0': { bezique: 0 } };
    const options = findFreshDeclarableMelds(rubiconBezique, hand, null, usage);
    expect(options.find((o) => o.kind === 'doubleBezique')).toBeDefined();
  });

  it('does not block reuse across different classes', () => {
    // The King has scored in 'sequence' already, but that should not block it from a 'quartet' meld.
    const hand = [c('SK-0', 'S', 'K'), c('HK-0', 'H', 'K'), c('DK-0', 'D', 'K'), c('CK-0', 'C', 'K')];
    const usage: Record<string, Partial<Record<MeldClass, number>>> = { 'SK-0': { sequence: 1 } };
    const options = findFreshDeclarableMelds(rubiconBezique, hand, null, usage);
    expect(options.find((o) => o.kind === 'fourKings')).toBeDefined();
  });
});

describe('replacement re-declaration (rules spec §3 worked examples)', () => {
  it('quartet worked example: re-forms "sixty Queens" using a spare Queen from a Marriage', () => {
    // Four Queens (fourQueens) declared and scored, then one (SQ-0) is played away.
    // A Marriage of spades is also standing, holding a second SQ (SQ-1) as its spare partner to SK-0.
    const fourQueens = meld({
      kind: 'fourQueens',
      class: 'quartet',
      cardIds: ['SQ-0', 'HQ-0', 'DQ-0', 'CQ-0'],
    });
    const marriage = meld({
      kind: 'marriage',
      class: 'sequence',
      suit: 'S',
      cardIds: ['SK-0', 'SQ-1'],
    });
    // SQ-0 has been played to a trick, so it's no longer in hand.
    const hand = [c('HQ-0', 'H', 'Q'), c('DQ-0', 'D', 'Q'), c('CQ-0', 'C', 'Q'), c('SK-0', 'S', 'K'), c('SQ-1', 'S', 'Q')];

    const options = findReplacementRedeclarations(rubiconBezique, hand, [fourQueens, marriage], null);
    const reformed = options.find((o) => o.replacesMeldId === fourQueens.id);
    expect(reformed).toBeDefined();
    expect(reformed!.points).toBe(60);
    expect(reformed!.cardIds.sort()).toEqual(['CQ-0', 'DQ-0', 'HQ-0', 'SQ-1'].sort());
  });

  it('marriage worked example: rearranges two same-suit marriages after one card is played', () => {
    // Two spade marriages standing: (SK-0, SQ-0) and (SK-1, SQ-1). SQ-0 gets played to a trick.
    const marriageA = meld({ kind: 'marriage', class: 'sequence', suit: 'S', cardIds: ['SK-0', 'SQ-0'] });
    const marriageB = meld({ kind: 'marriage', class: 'sequence', suit: 'S', cardIds: ['SK-1', 'SQ-1'] });
    const hand = [c('SK-0', 'S', 'K'), c('SK-1', 'S', 'K'), c('SQ-1', 'S', 'Q')];

    const options = findReplacementRedeclarations(rubiconBezique, hand, [marriageA, marriageB], 'S');
    const reformed = options.find((o) => o.replacesMeldId === marriageA.id);
    expect(reformed).toBeDefined();
    expect(reformed!.points).toBe(40); // trump marriage
    expect(reformed!.cardIds.sort()).toEqual(['SK-0', 'SQ-1'].sort());
  });

  it('does not offer a replacement when the meld is still fully standing', () => {
    const marriage = meld({ kind: 'marriage', class: 'sequence', suit: 'S', cardIds: ['SK-0', 'SQ-0'] });
    const hand = [c('SK-0', 'S', 'K'), c('SQ-0', 'S', 'Q')];
    const options = findReplacementRedeclarations(rubiconBezique, hand, [marriage], null);
    expect(options).toHaveLength(0);
  });

  it('does not offer a replacement when no spare of the right suit/rank is available', () => {
    const marriage = meld({ kind: 'marriage', class: 'sequence', suit: 'S', cardIds: ['SK-0', 'SQ-0'] });
    const hand = [c('SK-0', 'S', 'K')]; // SQ-0 played away, no spare Queen of spades anywhere
    const options = findReplacementRedeclarations(rubiconBezique, hand, [marriage], null);
    expect(options).toHaveLength(0);
  });

  it('accepts a genuinely fresh, never-melded duplicate as the spare (reported by a user)', () => {
    // Rules spec §3: "substituting a card — either a fresh one from hand, or one borrowed
    // from another standing meld". A player declared K♥+Q♥, played the King away, and holds
    // a SECOND King of Hearts that was never part of any other declared meld — this must
    // still be offered as a valid replacement, not just spares borrowed from another meld.
    const marriage = meld({ kind: 'marriage', class: 'sequence', suit: 'H', cardIds: ['HK-0', 'HQ-0'] });
    const hand = [c('HQ-0', 'H', 'Q'), c('HK-1', 'H', 'K')]; // HK-0 played away; HK-1 is fresh, unmelded
    const options = findReplacementRedeclarations(rubiconBezique, hand, [marriage], null);
    const reformed = options.find((o) => o.replacesMeldId === marriage.id);
    expect(reformed).toBeDefined();
    expect(reformed!.cardIds.sort()).toEqual(['HK-1', 'HQ-0'].sort());
  });
});

describe('findAllDeclarableMelds', () => {
  it('combines fresh and replacement options', () => {
    const marriage = meld({ kind: 'marriage', class: 'sequence', suit: 'S', cardIds: ['SK-0', 'SQ-0'] });
    const hand = [c('SK-0', 'S', 'K'), c('DK-0', 'D', 'K'), c('DQ-0', 'D', 'Q')];
    const options = findAllDeclarableMelds(rubiconBezique, hand, [marriage], null, {});
    expect(options.some((o) => o.kind === 'marriage' && o.suit === 'D' && !o.isReplacement)).toBe(true);
  });
});
