import { describe, expect, it } from 'vitest';
import { CLUB_PLAYER_TIER, EXPERT_TIER, NOVICE_TIER, WeightedAgent } from '../src/agents/weightedAgent.js';
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
    turnUpCard: null,
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

describe('WeightedAgent: club player tier', () => {
  it('declares the highest-value meld on offer', async () => {
    // Trumps already set to D, so the S marriage stays at the plain rate (20) and doesn't
    // get an establishes-trump boost — isolates "prefers the bigger meld" from that effect.
    const state = makeState({
      stage: 'awaitingMeldDecision',
      turn: 0,
      trumpSuit: 'D',
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
    const agent = new WeightedAgent(0, { ...CLUB_PLAYER_TIER, thinkingDelayMs: 0 });
    const legalMoves = getLegalMoves(state, 0);
    const move = await agent.chooseMove(state, legalMoves);
    expect(move.type).toBe('declareMeld');
    if (move.type === 'declareMeld') expect(move.meldKind).toBe('bezique'); // 40 beats the 20-pt plain marriage
  });

  it('prefers establishing trump in a suit the hand is strong in, correctly priced at the trump rate', async () => {
    // No trump set yet, and this hand has real depth in spades (K, Q, Q). Declaring the
    // marriage here both establishes trump AND is priced at 40 (trump), not 20 (plain) —
    // beating the flat 40-pt bezique once the suit-strength bonus is added.
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
    const agent = new WeightedAgent(0, { ...CLUB_PLAYER_TIER, thinkingDelayMs: 0 });
    const legalMoves = getLegalMoves(state, 0);
    const move = await agent.chooseMove(state, legalMoves);
    expect(move.type).toBe('declareMeld');
    if (move.type === 'declareMeld') expect(move.meldKind).toBe('marriage');
  });

  it('captures a cheap brisque when the lead card is worth taking', async () => {
    const state = makeState({
      stage: 'awaitingFollow',
      turn: 1,
      currentTrick: { leaderId: 0, leadCard: c('S10-0', 'S', '10') },
      players: [
        { id: 0, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [c('SA-0', 'S', 'A'), c('H7-0', 'H', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const agent = new WeightedAgent(1, { ...CLUB_PLAYER_TIER, thinkingDelayMs: 0 });
    const legalMoves = getLegalMoves(state, 1);
    const move = await agent.chooseMove(state, legalMoves);
    expect(move).toEqual({ type: 'playCard', playerId: 1, cardId: 'SA-0' });
  });
});

describe('WeightedAgent: novice tier', () => {
  it('sometimes picks a move other than the top-evaluated one (high randomness)', async () => {
    const state = makeState({
      turn: 0,
      players: [
        {
          id: 0,
          hand: [c('SA-0', 'S', 'A'), c('S7-0', 'S', '7'), c('S8-0', 'S', '8'), c('S9-0', 'S', '9')],
          melds: [],
          score: 0,
          carteBlanchePoints: 0,
        },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    // A rigged rng: first call decides "use randomness" (< randomness threshold), second picks an index.
    let call = 0;
    const rng = () => {
      call++;
      return call === 1 ? 0 : 0.9; // definitely trigger randomness, then pick near the end of the list
    };
    const agent = new WeightedAgent(0, { ...NOVICE_TIER, randomness: 1, thinkingDelayMs: 0 }, rng);
    const legalMoves = getLegalMoves(state, 0);
    const move = await agent.chooseMove(state, legalMoves);
    // With randomness forced to 1 and rng()=0.9, it should pick index floor(0.9*4)=3, not necessarily the "best" evaluated card.
    expect(move).toEqual(legalMoves[3]);
  });

  it('with randomness forced off, still behaves like a weighted evaluator (declares an available meld)', async () => {
    const state = makeState({
      stage: 'awaitingMeldDecision',
      turn: 0,
      players: [
        { id: 0, hand: [c('SK-0', 'S', 'K'), c('SQ-0', 'S', 'Q')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const agent = new WeightedAgent(0, { ...NOVICE_TIER, randomness: 0, thinkingDelayMs: 0 });
    const legalMoves = getLegalMoves(state, 0);
    const move = await agent.chooseMove(state, legalMoves);
    expect(move.type).toBe('declareMeld');
  });
});

describe('WeightedAgent: expert tier', () => {
  it('uses card-memory risk assessment (still resolves to a legal move without throwing)', async () => {
    const state = makeState({
      turn: 0,
      players: [
        { id: 0, hand: [c('SA-0', 'S', 'A'), c('H7-0', 'H', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const agent = new WeightedAgent(0, { ...EXPERT_TIER, thinkingDelayMs: 0 });
    const legalMoves = getLegalMoves(state, 0);
    const move = await agent.chooseMove(state, legalMoves);
    expect(legalMoves).toContainEqual(move);
  });

  it('applies endgame lookahead for lead decisions without throwing and returns a legal move', async () => {
    const state = makeState({
      phase: 'endgame',
      stage: 'awaitingLead',
      turn: 0,
      trumpSuit: 'H',
      currentTrick: { leaderId: 0, leadCard: null },
      players: [
        { id: 0, hand: [c('SA-0', 'S', 'A'), c('H7-0', 'H', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [c('S7-0', 'S', '7'), c('H8-0', 'H', '8')], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const agent = new WeightedAgent(0, { ...EXPERT_TIER, thinkingDelayMs: 0 });
    const legalMoves = getLegalMoves(state, 0);
    const move = await agent.chooseMove(state, legalMoves);
    expect(legalMoves).toContainEqual(move);
  });

  it('never mutates the state it is given', async () => {
    const state = makeState({
      phase: 'endgame',
      stage: 'awaitingLead',
      turn: 0,
      trumpSuit: 'H',
      players: [
        { id: 0, hand: [c('SA-0', 'S', 'A'), c('H7-0', 'H', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [c('S7-0', 'S', '7'), c('H8-0', 'H', '8')], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const snapshot = JSON.parse(JSON.stringify(state));
    const agent = new WeightedAgent(0, { ...EXPERT_TIER, thinkingDelayMs: 0 });
    await agent.chooseMove(state, getLegalMoves(state, 0));
    expect(state).toEqual(snapshot);
  });
});

describe('WeightedAgent: single legal move', () => {
  it('resolves immediately without consulting weights (e.g. a forced Pass)', async () => {
    const state = makeState({
      stage: 'awaitingMeldDecision',
      turn: 0,
      players: [
        { id: 0, hand: [c('S7-0', 'S', '7')], melds: [], score: 0, carteBlanchePoints: 0 },
        { id: 1, hand: [], melds: [], score: 0, carteBlanchePoints: 0 },
      ],
    });
    const agent = new WeightedAgent(0, { ...CLUB_PLAYER_TIER, thinkingDelayMs: 0 });
    const legalMoves = getLegalMoves(state, 0); // only 'pass' is legal — nothing declarable
    expect(legalMoves).toHaveLength(1);
    const move = await agent.chooseMove(state, legalMoves);
    expect(move).toEqual(legalMoves[0]);
  });
});
