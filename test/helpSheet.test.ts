import { describe, expect, it } from 'vitest';
import { buildHelpSheetContent } from '../src/engine/helpSheet.js';
import { rubiconBezique } from '../src/engine/ruleset.js';

describe('buildHelpSheetContent', () => {
  const content = buildHelpSheetContent(rubiconBezique);

  it('derives deck facts from the ruleset rather than hard-coding them', () => {
    expect(content.totalCards).toBe(128);
    expect(content.deckCopies).toBe(4);
    expect(content.cardsPerPlayer).toBe(9);
    expect(content.rankOrderHighToLow).toBe('A > 10 > K > Q > J > 9 > 8 > 7');
  });

  it('mirrors the scoring constants from the ruleset exactly', () => {
    expect(content.rubiconThreshold).toBe(rubiconBezique.rubiconThreshold);
    expect(content.gameBonus).toBe(rubiconBezique.gameBonus);
    expect(content.rubiconBonus).toBe(rubiconBezique.rubiconBonus);
    expect(content.lastTrickBonus).toBe(rubiconBezique.lastTrickBonus);
    expect(content.brisqueValue).toBe(rubiconBezique.brisqueValue);
    expect(content.roundTo).toBe(rubiconBezique.roundTo);
    expect(content.carteBlanchePoints).toBe(rubiconBezique.carteBlanchePoints);
  });

  it('lists every meld kind exactly once', () => {
    expect(content.meldTable).toHaveLength(10);
    const kinds = new Set(content.meldTable.map((r) => r.kind));
    expect(kinds.size).toBe(10);
  });

  it('formats bezique cards and points precisely, with no suit note', () => {
    const row = content.meldTable.find((r) => r.kind === 'bezique')!;
    expect(row.label).toBe('Bezique');
    expect(row.cards).toBe('Q♠ J♦');
    expect(row.suitNote).toBeUndefined();
    expect(row.points).toBe('40');
  });

  it('formats double bezique with four cards', () => {
    const row = content.meldTable.find((r) => r.kind === 'doubleBezique')!;
    expect(row.cards).toBe('Q♠ J♦ Q♠ J♦');
    expect(row.points).toBe('500');
  });

  it('formats marriage with a suit note and trump/plain point split', () => {
    const row = content.meldTable.find((r) => r.kind === 'marriage')!;
    expect(row.cards).toBe('K♠ Q♠');
    expect(row.suitNote).toMatch(/any suit/);
    expect(row.points).toBe('40 trump / 20 plain');
  });

  it('formats sequence with five cards in rank order', () => {
    const row = content.meldTable.find((r) => r.kind === 'sequence')!;
    expect(row.cards).toBe('A♠ 10♠ K♠ Q♠ J♠');
    expect(row.points).toBe('250 trump / 150 plain');
  });

  it('formats a quartet with one card per suit', () => {
    const row = content.meldTable.find((r) => r.kind === 'fourAces')!;
    expect(row.cards).toBe('A♠ A♥ A♦ A♣');
    expect(row.points).toBe('100');
  });

  it('groups melds by class (sequence, then bezique, then quartet) matching the rules spec', () => {
    const classes = content.meldTable.map((r) => {
      if (r.kind === 'marriage' || r.kind === 'sequence') return 'sequence';
      if (r.kind.toLowerCase().includes('bezique')) return 'bezique';
      return 'quartet';
    });
    const sequenceEnd = classes.lastIndexOf('sequence');
    const beziqueStart = classes.indexOf('bezique');
    const beziqueEnd = classes.lastIndexOf('bezique');
    const quartetStart = classes.indexOf('quartet');
    expect(sequenceEnd).toBeLessThan(beziqueStart);
    expect(beziqueEnd).toBeLessThan(quartetStart);
  });

  it('stays in sync if the ruleset changes (no hard-coded duplicate values)', () => {
    const tweaked = { ...rubiconBezique, rubiconThreshold: 2000, gameBonus: 999 };
    const tweakedContent = buildHelpSheetContent(tweaked);
    expect(tweakedContent.rubiconThreshold).toBe(2000);
    expect(tweakedContent.gameBonus).toBe(999);
  });
});
