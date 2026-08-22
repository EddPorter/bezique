import { describe, expect, it } from 'vitest';
import { classicBezique } from '../src/engine/classicBezique.js';
import { buildHelpSheetContent } from '../src/engine/helpSheet.js';
import { finalizeMatchDeal, startMatch, startNextMatchDeal } from '../src/engine/match.js';
import { findFreshDeclarableMelds } from '../src/engine/melds.js';
import { applyMove, getLegalMoves } from '../src/engine/moves.js';
import { dealNewHand } from '../src/engine/state.js';
import { buildDeck, makeRng, shuffle } from '../src/engine/deck.js';
import type { Card } from '../src/engine/types.js';

const c = (id: string, suit: Card['suit'], rank: Card['rank']): Card => ({ id, suit, rank });

describe('Classic Bezique: deck and deal', () => {
  it('builds a 64-card pack (2 x 32) and deals 8 to each player, with a turn-up card set aside', () => {
    const deck = buildDeck(classicBezique);
    expect(deck).toHaveLength(64);

    const rng = makeRng(1);
    const state = dealNewHand(classicBezique, 1, rng);
    expect(state.players[0].hand).toHaveLength(8);
    expect(state.players[1].hand).toHaveLength(8);
    expect(state.turnUpCard).not.toBeNull();
    expect(state.trumpSuit).toBe(state.turnUpCard!.suit);
    // 64 total - 16 dealt - 1 turn-up = 47 left in the drawable stock.
    expect(state.deck).toHaveLength(47);
  });

  it('the shuffled deck really does contain 2 copies of every card', () => {
    const deck = shuffle(buildDeck(classicBezique), makeRng(42));
    const aceOfSpadesCopies = deck.filter((card) => card.suit === 'S' && card.rank === 'A').length;
    expect(aceOfSpadesCopies).toBe(2);
  });
});

describe('Classic Bezique: no plain-suit Sequence', () => {
  it('never offers a Sequence in a non-trump suit, even with all 5 cards in hand', () => {
    const hand = [c('HA-0', 'H', 'A'), c('H10-0', 'H', '10'), c('HK-0', 'H', 'K'), c('HQ-0', 'H', 'Q'), c('HJ-0', 'H', 'J')];
    const options = findFreshDeclarableMelds(classicBezique, hand, 'S', {}); // trumps are spades, hand is all hearts
    expect(options.some((o) => o.kind === 'sequence')).toBe(false);
  });

  it('offers the trump Sequence once trumps are set and the hand holds it', () => {
    const hand = [c('SA-0', 'S', 'A'), c('S10-0', 'S', '10'), c('SK-0', 'S', 'K'), c('SQ-0', 'S', 'Q'), c('SJ-0', 'S', 'J')];
    const options = findFreshDeclarableMelds(classicBezique, hand, 'S', {});
    const sequence = options.find((o) => o.kind === 'sequence');
    expect(sequence).toBeDefined();
    expect(sequence!.points).toBe(250);
  });
});

describe('Classic Bezique: no Triple/Quadruple Bezique', () => {
  it('caps Bezique-family speculative value at Double Bezique even with more pairs than the meld table allows', () => {
    expect(classicBezique.meldTable.tripleBezique).toBeUndefined();
    expect(classicBezique.meldTable.quadrupleBezique).toBeUndefined();
    const hand = [c('SQ-0', 'S', 'Q'), c('SQ-1', 'S', 'Q'), c('DJ-0', 'D', 'J'), c('DJ-1', 'D', 'J')];
    const options = findFreshDeclarableMelds(classicBezique, hand, null, {});
    const doubleBezique = options.find((o) => o.kind === 'doubleBezique');
    expect(doubleBezique).toBeDefined();
    expect(doubleBezique!.points).toBe(500);
  });
});

describe('Classic Bezique: help sheet', () => {
  it('reports the match target instead of a rubicon threshold', () => {
    const content = buildHelpSheetContent(classicBezique);
    expect(content.matchTargetScore).toBe(1000);
    expect(content.rubiconThreshold).toBeUndefined();
  });

  it('shows the trump-only note and trumps-only points for the Sequence row', () => {
    const content = buildHelpSheetContent(classicBezique);
    const row = content.meldTable.find((r) => r.kind === 'sequence');
    expect(row).toBeDefined();
    expect(row!.points).toBe('250 (trumps only)');
    expect(row!.suitNote).toMatch(/no plain-suit version exists/);
  });
});

describe('Classic Bezique: full random-match smoke test', () => {
  it('plays several complete random matches (many deals each) to a decided winner without crashing', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = makeRng(seed);
      let match = startMatch(classicBezique, 1, rng);
      let dealCount = 0;

      while (match.winnerId === null && dealCount < 300) {
        let moveGuard = 0;
        while (match.deal.phase !== 'complete' && moveGuard < 20000) {
          moveGuard++;
          if (match.deal.phase === 'scoring') {
            match = finalizeMatchDeal(match);
            continue;
          }
          const legal = getLegalMoves(match.deal, match.deal.turn);
          if (legal.length === 0) break;
          const move = legal[Math.floor(rng() * legal.length)]!;
          match = { ...match, deal: applyMove(match.deal, move) };
        }
        expect(moveGuard).toBeLessThan(20000);
        dealCount++;
        if (match.winnerId === null) {
          match = startNextMatchDeal(match, rng);
        }
      }

      expect(dealCount).toBeLessThan(300);
      expect(match.winnerId).not.toBeNull();
      expect(match.scores[match.winnerId!]).toBeGreaterThanOrEqual(classicBezique.matchMode.kind === 'cumulativeToTarget' ? classicBezique.matchMode.targetScore : Infinity);
    }
  });
});
