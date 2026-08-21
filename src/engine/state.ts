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

  // Classic Bezique (docs/classic-bezique-rules-spec.md §1): the next card after both
  // hands are dealt is turned face-up to set trumps immediately, and sits on the table
  // separately from the stock — not drawable, not in either hand. Rubicon/Chinese Bezique
  // leave trumps undetermined until the first marriage/sequence (state.ts's caller sees
  // trumpSuit stay null, exactly as before this variant existed).
  const turnUpCard = ruleset.trumpDetermination === 'turnedUpCard' ? (stock[0] ?? null) : null;
  const trumpSuit = turnUpCard?.suit ?? null;
  const remainingStock = turnUpCard ? stock.slice(1) : stock;

  // Classic Bezique (docs/classic-bezique-rules-spec.md §1/§2): if the turned-up trump card
  // is itself the dix (a 7), the dealer scores its points immediately at the deal — a
  // separate, one-time event from the in-hand dix declaration mechanic, and independent of
  // it (the card stays available on the table for the eventual exchange either way).
  const dealtPlayers: [Player, Player] =
    ruleset.dix && turnUpCard?.rank === '7'
      ? (players.map((p) => (p.id === dealerId ? { ...p, score: p.score + ruleset.dix!.points } : p)) as [
          Player,
          Player,
        ])
      : players;

  return {
    ruleset,
    deck: remainingStock,
    players: dealtPlayers,
    trumpSuit,
    turnUpCard,
    phase: 'main',
    stage: 'awaitingLead',
    currentTrick: { leaderId: nonDealerId, leadCard: null },
    tricksWon: { 0: [], 1: [] },
    cardMeldClassUsage: {},
    dixScoredCardIds: {},
    turn: nonDealerId,
    dealerId,
    lastTrickWinnerId: null,
    history: [],
  };
}
