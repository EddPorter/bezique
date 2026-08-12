import { hasCarteBlanche } from './cards.js';
import { buildDeck, deal, shuffle, type Rng } from './deck.js';
import type { GameState, Player, PlayerId, Ruleset } from './types.js';

/**
 * Deals a fresh hand. In Rubicon Bezique each deal IS a complete game
 * (rules spec §5.1) — there's no running score to carry in, so this is the
 * only place a GameState gets created.
 */
export function dealNewHand(ruleset: Ruleset, dealerId: PlayerId, rng: Rng): GameState {
  const deck = shuffle(buildDeck(ruleset), rng);
  const { hands, stock } = deal(deck, ruleset, dealerId);
  const nonDealerId: PlayerId = dealerId === 0 ? 1 : 0;

  const players = ([0, 1] as PlayerId[]).map((id): Player => {
    const hand = hands[id]!;
    const carteBlanchePoints = hasCarteBlanche(hand) ? ruleset.carteBlanchePoints : 0;
    return {
      id,
      hand,
      melds: [],
      score: carteBlanchePoints,
      carteBlanchePoints,
    };
  }) as [Player, Player];

  return {
    ruleset,
    deck: stock,
    players,
    trumpSuit: null,
    phase: 'main',
    stage: 'awaitingLead',
    currentTrick: { leaderId: nonDealerId, leadCard: null },
    tricksWon: { 0: [], 1: [] },
    cardMeldClassUsage: {},
    turn: nonDealerId,
    dealerId,
    lastTrickWinnerId: null,
    history: [],
  };
}
