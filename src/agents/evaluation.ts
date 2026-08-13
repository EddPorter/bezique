import { isBrisqueCard, rankValue } from '../engine/cards.js';
import { buildDeck } from '../engine/deck.js';
import { findAllDeclarableMelds, findFreshDeclarableMelds } from '../engine/melds.js';
import type { Card, GameState, Move, PlayerId, Suit } from '../engine/types.js';

export { isBrisqueCard } from '../engine/cards.js';

/**
 * The shared weighted evaluation function (architecture plan §5): every AI
 * tier and, later, the tutor score moves through this SAME function and
 * structured breakdown — tiers differ only in the weights (and, for Expert,
 * which risk estimator they use), never in separate scoring algorithms. The
 * breakdown shape is designed so the tutor can turn the dominant factor into
 * a plain-English reason later; AI tiers only need `.total`.
 */
export interface EvaluationWeights {
  trickValue: number;
  meldProgress: number;
  /** Exposure from leading/discarding: brisque capture risk AND the cost of giving up a trump card. */
  brisqueRisk: number;
  informationGivenAway: number;
}

export interface EvaluationBreakdown {
  trickValue: number;
  meldProgress: number;
  brisqueRisk: number;
  informationGivenAway: number;
  total: number;
}

/** Flat value of holding onto a trump card rather than leading/discarding it, independent
 * of whether it's also a brisque — scaled to be comparable to a typical brisque risk penalty. */
const TRUMP_CONSERVATION_VALUE = 3;

/** The certain (not probabilistic) cost of a card leaving your hand for good: full brisque
 * value if it's a brisque, plus the flat trump-conservation cost if it's a trump. Used when
 * the outcome is already known (losing a follow), as opposed to `riskEstimator`, which is
 * for leads/discards where whether the card gets captured is still uncertain. */
function certainSurrenderCost(state: GameState, card: Card): number {
  let cost = 0;
  if (isBrisqueCard(card)) cost += state.ruleset.brisqueValue;
  if (state.trumpSuit !== null && card.suit === state.trumpSuit) cost += TRUMP_CONSERVATION_VALUE;
  return cost;
}

function findCardById(hand: Card[], id: string): Card {
  const card = hand.find((c) => c.id === id);
  if (!card) throw new Error(`Card ${id} not in hand`);
  return card;
}

function wouldBeatLead(followCard: Card, leadCard: Card, trumpSuit: Suit | null): boolean {
  if (followCard.suit === leadCard.suit) return rankValue(followCard.rank) > rankValue(leadCard.rank);
  return trumpSuit !== null && followCard.suit === trumpSuit;
}

/** Points forfeited by playing `cardId` away: the best currently-fresh-declarable
 * meld that uses it, if any — i.e. what you'd give up by no longer holding it. */
function meldForfeitCost(state: GameState, playerId: PlayerId, cardId: string): number {
  const player = state.players[playerId];
  const options = findFreshDeclarableMelds(state.ruleset, player.hand, state.trumpSuit, state.cardMeldClassUsage);
  const relevant = options.filter((o) => o.cardIds.includes(cardId));
  return relevant.length > 0 ? Math.max(...relevant.map((o) => o.points)) : 0;
}

/**
 * Estimates the probability (0-1) that a led/discarded card could be beaten.
 * Tiers plug in different estimators — this is the "weak vs. perfect card
 * memory" distinction from the architecture plan, not a different algorithm.
 */
export type RiskEstimator = (state: GameState, playerId: PlayerId, card: Card) => number;

/** No card counting: Aces are hard to beat, 10s a bit less so, everything else is safe. */
export const flatRiskEstimator: RiskEstimator = (_state, _playerId, card) => {
  if (card.rank === 'A') return 0.15;
  if (card.rank === '10') return 0.35;
  return 0;
};

/**
 * Perfect memory of what's been played (architecture plan §5, Expert tier):
 * counts how many "threat" cards (same suit and higher, or any trump) are
 * still unaccounted for — not in this player's own hand, and not already
 * played to a trick — and returns that as a fraction of the whole unseen
 * pool. This only uses information a careful player could infer (what's
 * been played), never the opponent's actual hand.
 */
export function makeCardMemoryRiskEstimator(): RiskEstimator {
  return (state, playerId, card) => {
    const allCards = buildDeck(state.ruleset);
    const seenIds = new Set<string>([
      ...state.players[playerId].hand.map((c) => c.id),
      ...state.tricksWon[0].map((c) => c.id),
      ...state.tricksWon[1].map((c) => c.id),
    ]);
    const unseen = allCards.filter((c) => !seenIds.has(c.id));
    if (unseen.length === 0) return 0;
    const threats = unseen.filter((c) => {
      if (c.suit === card.suit) return rankValue(c.rank) > rankValue(card.rank);
      return state.trumpSuit !== null && c.suit === state.trumpSuit && card.suit !== state.trumpSuit;
    });
    return threats.length / unseen.length;
  };
}

export function evaluateMove(
  state: GameState,
  playerId: PlayerId,
  move: Move,
  weights: EvaluationWeights,
  riskEstimator: RiskEstimator = flatRiskEstimator,
): EvaluationBreakdown {
  const player = state.players[playerId];
  const hand = player.hand;
  let trickValue = 0;
  let meldProgress = 0;
  let brisqueRisk = 0;
  let informationGivenAway = 0;

  if (move.type === 'declareMeld') {
    const options = findAllDeclarableMelds(state.ruleset, hand, player.melds, state.trumpSuit, state.cardMeldClassUsage);
    const chosen = options.find(
      (o) =>
        o.kind === move.meldKind &&
        o.cardIds.length === move.cardIds.length &&
        o.cardIds.every((id) => move.cardIds.includes(id)),
    );
    meldProgress = chosen?.points ?? 0;
    // Declaring reveals cards to the opponent — bigger melds give away more.
    informationGivenAway = -Math.min(meldProgress * 0.05, 5);
  } else if (move.type === 'pass') {
    const options = findAllDeclarableMelds(state.ruleset, hand, player.melds, state.trumpSuit, state.cardMeldClassUsage);
    const best = options.length > 0 ? Math.max(...options.map((o) => o.points)) : 0;
    meldProgress = -best;
  } else {
    const card = findCardById(hand, move.cardId);
    meldProgress = -meldForfeitCost(state, playerId, card.id);

    if (state.stage === 'awaitingFollow' && state.currentTrick.leadCard) {
      const leadCard = state.currentTrick.leadCard;
      const wins = wouldBeatLead(card, leadCard, state.trumpSuit);
      if (wins) {
        const captured =
          (isBrisqueCard(leadCard) ? state.ruleset.brisqueValue : 0) + (isBrisqueCard(card) ? state.ruleset.brisqueValue : 0);
        // Small flat bonus for winning (gains the lead + a meld window), and a tiny
        // preference for the cheapest winning card when several would all win.
        trickValue = captured + 5 - rankValue(card.rank) * 0.01;
      } else {
        // A definite loss: give up the least by discarding the card with the smallest
        // surrender cost, and among equal-cost options (typically several low, non-trump,
        // non-brisque cards worth nothing at all), prefer shedding the lowest rank first.
        trickValue = -certainSurrenderCost(state, card) - rankValue(card.rank) * 0.01;
      }
    } else {
      // Leading, or an unconstrained main-phase discard: no trick to resolve yet,
      // just an exposure/conservation estimate. (Endgame leads get a more precise
      // treatment via simulated lookahead in weightedAgent.ts, since the opponent
      // is constrained there in ways this flat estimate doesn't model.)
      let exposure = 0;
      if (isBrisqueCard(card)) {
        exposure += state.ruleset.brisqueValue * riskEstimator(state, playerId, card);
      }
      if (state.trumpSuit !== null && card.suit === state.trumpSuit) {
        // Trumps are worth conserving even when they aren't brisques: they're the
        // only cards that can win a trick off-suit, and they're needed for a trump
        // marriage/sequence. TRUMP_CONSERVATION_VALUE is comparable in scale to a
        // typical brisqueRisk penalty (brisqueValue * ~0.15-0.35).
        exposure += TRUMP_CONSERVATION_VALUE;
      }
      brisqueRisk = -exposure;
    }
  }

  const total =
    trickValue * weights.trickValue +
    meldProgress * weights.meldProgress +
    brisqueRisk * weights.brisqueRisk +
    informationGivenAway * weights.informationGivenAway;

  return { trickValue, meldProgress, brisqueRisk, informationGivenAway, total };
}
