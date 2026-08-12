import { describe, expect, it } from 'vitest';
import { chooseClubPlayerMove } from '../src/agents/clubPlayerAgent.js';
import { getLegalMoves } from '../src/engine/moves.js';
import { rubiconBezique } from '../src/engine/ruleset.js';
import type { Card, GameState } from '../src/engine/types.js';

const c = (id: string, suit: Card['suit'], rank: Card['rank']): Card => ({ id, suit, rank });

function makeState(overrides: Partial<GameState> = {}): GameState {
  const base: GameState = {
    ruleset: rubiconBezique,
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

describe('chooseClubPlayerMove', () => {
  it('declares the highest-value meld when several are available', () => {
    const state = makeState({
      stage: 'awaitingMeldDecision',
      turn: 0,
      players: [
        {
          id: 0,
          hand: [c('SK-0', 'S', 'K'), c('SQ-0', 'S', 'Q'), c('SQ-1', 'S', 'Q'), c('DJ-0', 'D', 'J')],
          melds: [],
          score: 0,
          carteBlanchePoints: 0,
        },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const legalMoves = getLegalMoves(state, 0);
    const move = chooseClubPlayerMove(state, 0, legalMoves) as Extract<typeof legalMoves[number], { type: 'declareMeld' }>;
    // Bezique (SQ+DJ, 40) should beat the common marriage (SK+SQ, 20) — either physical Queen duplicate is fine.
    expect(move.type).toBe('declareMeld');
    expect(move.meldKind).toBe('bezique');
    expect(move.cardIds).toContain('DJ-0');
  });

  it('leads the least valuable card, avoiding brisques and court cards', () => {
    const state = makeState({
      turn: 0,
      players: [
        { id: 0, hand: [c('SA-0', 'S', 'A'), c('S7-0', 'S', '7'), c('SK-0', 'S', 'K')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const legalMoves = getLegalMoves(state, 0);
    const move = chooseClubPlayerMove(state, 0, legalMoves);
    expect(move).toEqual({ type: 'playCard', playerId: 0, cardId: 'S7-0' });
  });

  it('captures a brisque cheaply when the lead card is worth taking', () => {
    // Lead is a 10 (a brisque); only an Ace of spades beats it in-suit.
    const state = makeState({
      stage: 'awaitingFollow',
      turn: 1,
      currentTrick: { leaderId: 0, leadCard: c('S10-0', 'S', '10') },
      players: [
        { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
        {
          id: 1,
          hand: [c('SA-0', 'S', 'A'), c('S9-0', 'S', '9'), c('H7-0', 'H', '7')],
          melds: [],
          score: 0,
          carteBlanchePoints: 0,
        },
      ],
    });
    const legalMoves = getLegalMoves(state, 1);
    const move = chooseClubPlayerMove(state, 1, legalMoves);
    expect(move).toEqual({ type: 'playCard', playerId: 1, cardId: 'SA-0' });
  });

  it('discards the least valuable card when the lead is not worth chasing', () => {
    const state = makeState({
      stage: 'awaitingFollow',
      turn: 1,
      currentTrick: { leaderId: 0, leadCard: c('S7-0', 'S', '7') },
      players: [
        { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
        {
          id: 1,
          hand: [c('SK-0', 'S', 'K'), c('H8-0', 'H', '8'), c('SA-0', 'S', 'A')],
          melds: [],
          score: 0,
          carteBlanchePoints: 0,
        },
      ],
    });
    const legalMoves = getLegalMoves(state, 1);
    const move = chooseClubPlayerMove(state, 1, legalMoves);
    // Not worth chasing a bare 7; discard the least valuable card (H8, off-suit non-court non-brisque).
    expect(move).toEqual({ type: 'playCard', playerId: 1, cardId: 'H8-0' });
  });
});
