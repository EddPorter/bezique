import { describe, expect, it } from 'vitest';
import { buildHelpSheetContent } from '../src/engine/helpSheet.js';
import { applyMove, getLegalMoves } from '../src/engine/moves.js';
import { findFreshDeclarableMelds } from '../src/engine/melds.js';
import { finalizeScoring } from '../src/engine/scoring.js';
import { dealNewHand } from '../src/engine/state.js';
import { chineseBezique } from '../src/engine/chineseBezique.js';
import { buildDeck, makeRng, shuffle } from '../src/engine/deck.js';
import type { Card, GameState } from '../src/engine/types.js';

const c = (id: string, suit: Card['suit'], rank: Card['rank']): Card => ({ id, suit, rank });

function makeState(overrides: Partial<GameState> = {}): GameState {
  const base: GameState = {
    ruleset: chineseBezique,
    deck: [],
    players: [
      { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
    ],
    trumpSuit: null,
    phase: 'main',
    stage: 'awaitingLead',
    currentTrick: { leaderId: 0, leadCard: null },
    tricksWon: { 0: [], 1: [] },
    cardMeldClassUsage: {},
    turn: 0,
    dealerId: 1,
    lastTrickWinnerId: null,
    history: [],
  };
  return { ...base, ...overrides };
}

describe('Chinese Bezique: deck and deal', () => {
  it('builds a 192-card pack (6 x 32)', () => {
    const deck = buildDeck(chineseBezique);
    expect(deck).toHaveLength(192);
  });

  it('deals 12 cards to each player', () => {
    const rng = makeRng(1);
    const state = dealNewHand(chineseBezique, 1, rng);
    expect(state.players[0].hand).toHaveLength(12);
    expect(state.players[1].hand).toHaveLength(12);
    expect(state.deck).toHaveLength(192 - 24);
  });
});

describe('Chinese Bezique: trump quartets', () => {
  it('offers a trump quartet only once trumps are set, in the correct suit', () => {
    const hand = [c('SA-0', 'S', 'A'), c('SA-1', 'S', 'A'), c('SA-2', 'S', 'A'), c('SA-3', 'S', 'A')];
    const noTrumpYet = findFreshDeclarableMelds(chineseBezique, hand, null, {});
    expect(noTrumpYet.find((o) => o.kind === 'fourTrumpAces')).toBeUndefined();

    const wrongTrump = findFreshDeclarableMelds(chineseBezique, hand, 'H', {});
    expect(wrongTrump.find((o) => o.kind === 'fourTrumpAces')).toBeUndefined();

    const rightTrump = findFreshDeclarableMelds(chineseBezique, hand, 'S', {});
    const trumpAces = rightTrump.find((o) => o.kind === 'fourTrumpAces');
    expect(trumpAces).toBeDefined();
    expect(trumpAces!.points).toBe(1000);
    expect(trumpAces!.cardIds.sort()).toEqual(['SA-0', 'SA-1', 'SA-2', 'SA-3'].sort());
  });

  it('still offers the plain (one-per-suit) Four Aces alongside the trump quartet', () => {
    const hand = [c('SA-0', 'S', 'A'), c('HA-0', 'H', 'A'), c('DA-0', 'D', 'A'), c('CA-0', 'C', 'A')];
    const options = findFreshDeclarableMelds(chineseBezique, hand, 'S', {});
    const plainAces = options.find((o) => o.kind === 'fourAces');
    expect(plainAces).toBeDefined();
    expect(plainAces!.points).toBe(100);
  });

  it('allows a card already scored in the plain quartet to be reused upward into the trump quartet', () => {
    // SA-0 already scored in plain Four Aces (classRank 0); the other 3 trump aces are fresh.
    const hand = [c('SA-0', 'S', 'A'), c('SA-1', 'S', 'A'), c('SA-2', 'S', 'A'), c('SA-3', 'S', 'A')];
    const usage = { 'SA-0': { quartet: 0 } };
    const options = findFreshDeclarableMelds(chineseBezique, hand, 'S', usage);
    const trumpAces = options.find((o) => o.kind === 'fourTrumpAces');
    expect(trumpAces).toBeDefined();
    expect(trumpAces!.cardIds).toContain('SA-0');
  });

  it('blocks reusing a card already scored in the trump quartet back down into a fresh plain quartet', () => {
    const hand = [c('SA-0', 'S', 'A'), c('HA-0', 'H', 'A'), c('DA-0', 'D', 'A'), c('CA-0', 'C', 'A')];
    // SA-0 already scored at the trump quartet's classRank (1).
    const usage = { 'SA-0': { quartet: 1 } };
    const options = findFreshDeclarableMelds(chineseBezique, hand, 'S', usage);
    expect(options.find((o) => o.kind === 'fourAces')).toBeUndefined();
  });

  it('scores both the plain and trump quartet cumulatively when declared as two separate events', () => {
    let state = makeState({
      stage: 'awaitingMeldDecision',
      trumpSuit: 'S',
      turn: 0,
      players: [
        {
          id: 0,
          hand: [c('SA-0', 'S', 'A'), c('HA-0', 'H', 'A'), c('DA-0', 'D', 'A'), c('CA-0', 'C', 'A'), c('SA-1', 'S', 'A'), c('SA-2', 'S', 'A'), c('SA-3', 'S', 'A')],
          melds: [],
          score: 0,
          carteBlanchePoints: 0,
        },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });

    const plainMove = getLegalMoves(state, 0).find(
      (m) => m.type === 'declareMeld' && m.meldKind === 'fourAces',
    );
    expect(plainMove).toBeDefined();
    state = applyMove(state, plainMove!);
    expect(state.players[0].score).toBe(100);

    // Back into a meld-decision window to declare again (draws already happened after the
    // first declaration; force the stage back for this second, independent declaration).
    state = { ...state, stage: 'awaitingMeldDecision' };
    const trumpMove = getLegalMoves(state, 0).find(
      (m) => m.type === 'declareMeld' && m.meldKind === 'fourTrumpAces',
    );
    expect(trumpMove).toBeDefined();
    state = applyMove(state, trumpMove!);
    expect(state.players[0].score).toBe(100 + 1000);
  });
});

describe('Chinese Bezique: no quintuple/sextuple Bezique', () => {
  it('caps Bezique-family speculative value at the Quadruple tier even with 5+ pairs available', () => {
    // 5 Q♠ + 5 J♦ in hand (possible with 6 decks) — the source is explicit there is no
    // score above Quadruple Bezique (4,500), so this must not price beyond that ceiling.
    const hand = [
      ...Array.from({ length: 5 }, (_, i) => c(`SQ-${i}`, 'S', 'Q')),
      ...Array.from({ length: 5 }, (_, i) => c(`DJ-${i}`, 'D', 'J')),
    ];
    const options = findFreshDeclarableMelds(chineseBezique, hand, null, {});
    const quadruple = options.find((o) => o.kind === 'quadrupleBezique');
    expect(quadruple).toBeDefined();
    expect(quadruple!.points).toBe(4500);
    expect(options.some((o) => o.kind !== 'quadrupleBezique' && o.kind.toLowerCase().includes('bezique') && o.points > 4500)).toBe(false);
  });
});

describe('Chinese Bezique: scoring numbers', () => {
  it('uses the 3,000-point rubicon threshold and 1,000-point rubicon bonus', () => {
    const state = makeState({
      phase: 'scoring',
      players: [
        { id: 0, hand: [], melds: [], score: 3200, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 1500, carteBlanchePoints: 0 }, // under 3,000 -> rubiconed
      ],
      tricksWon: { 0: [], 1: [] },
    });
    const result = finalizeScoring(state).result!;
    expect(result.rubiconed).toBe(true);
    // winner(3200) + max(loser(1500),100) + 1000 bonus
    expect(result.winnerFinalScore).toBe(3200 + 1500 + 1000);
  });
});

describe('Chinese Bezique: help sheet', () => {
  it('generates rows for the trump quartets with the trump-suit note', () => {
    const content = buildHelpSheetContent(chineseBezique);
    const row = content.meldTable.find((r) => r.kind === 'fourTrumpAces');
    expect(row).toBeDefined();
    expect(row!.points).toBe('1000');
    expect(row!.suitNote).toMatch(/currently trump/);
  });
});

describe('Chinese Bezique: full random-game smoke test', () => {
  it('plays many complete random games without crashing', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = makeRng(seed);
      let state = dealNewHand(chineseBezique, 1, rng);
      let guard = 0;
      while (state.phase !== 'complete' && guard < 20000) {
        guard++;
        if (state.phase === 'scoring') {
          state = finalizeScoring(state);
          continue;
        }
        const legal = getLegalMoves(state, state.turn);
        if (legal.length === 0) break;
        const move = legal[Math.floor(rng() * legal.length)]!;
        state = applyMove(state, move);
      }
      expect(guard).toBeLessThan(20000);
    }
  });

  it('the shuffled deck really does contain 6 copies of every card', () => {
    const deck = shuffle(buildDeck(chineseBezique), makeRng(42));
    const aceOfSpadesCopies = deck.filter((card) => card.suit === 'S' && card.rank === 'A').length;
    expect(aceOfSpadesCopies).toBe(6);
  });
});
