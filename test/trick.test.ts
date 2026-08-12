import { describe, expect, it } from 'vitest';
import { resolveTrick } from '../src/engine/trick.js';
import type { Card } from '../src/engine/types.js';

const card = (id: string, suit: Card['suit'], rank: Card['rank']): Card => ({ id, suit, rank });

describe('resolveTrick', () => {
  it('higher card of the suit led wins', () => {
    const lead = card('SK-0', 'S', 'K');
    const follow = card('SA-0', 'S', 'A');
    expect(resolveTrick(lead, 0, follow, 1, null)).toBe(1);
  });

  it('lower follow of the same suit loses to the lead', () => {
    const lead = card('SA-0', 'S', 'A');
    const follow = card('SK-0', 'S', 'K');
    expect(resolveTrick(lead, 0, follow, 1, null)).toBe(0);
  });

  it('identical cards: the lead (played first) wins', () => {
    const lead = card('SK-0', 'S', 'K');
    const follow = card('SK-1', 'S', 'K');
    expect(resolveTrick(lead, 0, follow, 1, null)).toBe(0);
  });

  it('a trump follow beats a non-trump lead of a different suit', () => {
    const lead = card('S7-0', 'S', '7');
    const follow = card('H7-0', 'H', '7');
    expect(resolveTrick(lead, 0, follow, 1, 'H')).toBe(1);
  });

  it('a non-trump follow of a different suit never beats the lead', () => {
    const lead = card('SA-0', 'S', 'A');
    const follow = card('H7-0', 'H', '7');
    expect(resolveTrick(lead, 0, follow, 1, 'D')).toBe(0);
  });

  it('with no trump suit yet, off-suit follow always loses to the lead', () => {
    const lead = card('S7-0', 'S', '7');
    const follow = card('HA-0', 'H', 'A');
    expect(resolveTrick(lead, 0, follow, 1, null)).toBe(0);
  });

  it('lead in the trump suit beats an off-suit follow regardless of rank', () => {
    const lead = card('H7-0', 'H', '7');
    const follow = card('SA-0', 'S', 'A');
    expect(resolveTrick(lead, 0, follow, 1, 'H')).toBe(0);
  });
});
