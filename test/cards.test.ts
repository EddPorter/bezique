import { describe, expect, it } from 'vitest';
import { findCard, isCourtCard, rankValue, removeCard } from '../src/engine/cards.js';
import type { Card } from '../src/engine/types.js';

describe('rankValue', () => {
  it('orders A > 10 > K > Q > J > 9 > 8 > 7', () => {
    expect(rankValue('A')).toBeGreaterThan(rankValue('10'));
    expect(rankValue('10')).toBeGreaterThan(rankValue('K'));
    expect(rankValue('K')).toBeGreaterThan(rankValue('Q'));
    expect(rankValue('Q')).toBeGreaterThan(rankValue('J'));
    expect(rankValue('J')).toBeGreaterThan(rankValue('9'));
    expect(rankValue('9')).toBeGreaterThan(rankValue('8'));
    expect(rankValue('8')).toBeGreaterThan(rankValue('7'));
  });
});

describe('isCourtCard', () => {
  it('treats J, Q, K, A as court cards', () => {
    expect(isCourtCard('J')).toBe(true);
    expect(isCourtCard('Q')).toBe(true);
    expect(isCourtCard('K')).toBe(true);
    expect(isCourtCard('A')).toBe(true);
  });

  it('treats 7-10 as non-court', () => {
    expect(isCourtCard('10')).toBe(false);
    expect(isCourtCard('9')).toBe(false);
    expect(isCourtCard('8')).toBe(false);
    expect(isCourtCard('7')).toBe(false);
  });
});

describe('findCard / removeCard', () => {
  const cards: Card[] = [
    { id: 'SQ-0', suit: 'S', rank: 'Q' },
    { id: 'DJ-0', suit: 'D', rank: 'J' },
  ];

  it('finds a card by id', () => {
    expect(findCard(cards, 'DJ-0')?.rank).toBe('J');
    expect(findCard(cards, 'nope')).toBeUndefined();
  });

  it('removes a card by id without mutating the input', () => {
    const result = removeCard(cards, 'SQ-0');
    expect(result.map((c) => c.id)).toEqual(['DJ-0']);
    expect(cards).toHaveLength(2);
  });

  it('throws when the card is not present', () => {
    expect(() => removeCard(cards, 'nope')).toThrow();
  });
});
