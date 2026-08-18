import { isBrisqueCard, rankValue } from '../engine/cards.js';
import { buildDeck } from '../engine/deck.js';
import { findAllDeclarableMelds, findFreshDeclarableMelds, meldPoints, requiredSlots } from '../engine/melds.js';
import type { Card, GameState, MeldKind, Move, PlayerId, Ruleset, Suit } from '../engine/types.js';

export { isBrisqueCard } from '../engine/cards.js';

/**
 * The shared weighted evaluation function (architecture plan §5): every AI
 * tier and, later, the tutor score moves through this SAME function and
 * structured breakdown — tiers differ only in the weights (and, for Expert,
 * which risk estimator they use), never in separate scoring algorithms. The
 * breakdown shape is designed so the tutor can turn the dominant factor into
 * a plain-English reason later; AI tiers only need `.total`.
 *
 * Strategic reasoning beyond the base rules is sourced from real Bezique
 * strategy writing, not invented from scratch — see docs/ai-strategy-notes.md
 * for the sources and, importantly, which pieces of generic advice DON'T
 * apply to this specific (Portland Club-sourced) ruleset.
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

const other = (id: PlayerId): PlayerId => (id === 0 ? 1 : 0);

/** Flat value of holding onto a trump card rather than leading/discarding it, independent
 * of whether it's also a brisque — scaled to be comparable to a typical brisque risk penalty. */
const TRUMP_CONSERVATION_VALUE = 3;

/** Once a hand holds this many trumps, conservation value tapers off — "if you have long
 * trumps, draw the opponents out" (docs/ai-strategy-notes.md) rather than hoarding every
 * last one regardless of how many you already have. */
const LONG_TRUMP_THRESHOLD = 4;
const LONG_TRUMP_TAPER = 0.3;

function trumpConservationValue(hand: Card[], trumpSuit: Suit | null): number {
  if (trumpSuit === null) return 0;
  const trumpCount = hand.filter((c) => c.suit === trumpSuit).length;
  return trumpCount >= LONG_TRUMP_THRESHOLD ? TRUMP_CONSERVATION_VALUE * LONG_TRUMP_TAPER : TRUMP_CONSERVATION_VALUE;
}

/**
 * How much brisques currently matter. Per the rules (spec §5.4) they only ever count
 * toward the final score to break a near-tie or rescue a rubicon — melds dominate normal
 * scoring. Scales every brisque-specific term (not the flat trick-win bonus, and not trump
 * conservation, which matters independently) so the model doesn't chase brisques when the
 * meld score already decides the hand comfortably. "Near-rubicon" only fires late in the
 * hand — being under the threshold early on doesn't mean much when scores are still
 * growing turn by turn.
 */
const BRISQUE_BASELINE_SIGNIFICANCE = 0.25;
const BRISQUE_MARGIN_SIGNIFICANCE = 1;
const TIE_MARGIN_BUCKETS = 2;
const LATE_HAND_STOCK_THRESHOLD = 20;

function brisqueSignificance(state: GameState, playerId: PlayerId): number {
  const opponentId = other(playerId);
  const roundTo = state.ruleset.roundTo;
  const myScore = state.players[playerId].score;
  const oppScore = state.players[opponentId].score;

  const nearTie = Math.abs(myScore - oppScore) < roundTo * TIE_MARGIN_BUCKETS;

  const lateInHand = state.phase === 'endgame' || state.deck.length <= LATE_HAND_STOCK_THRESHOLD;
  const rubiconRisk = lateInHand && (myScore < state.ruleset.rubiconThreshold || oppScore < state.ruleset.rubiconThreshold);

  return nearTie || rubiconRisk ? BRISQUE_MARGIN_SIGNIFICANCE : BRISQUE_BASELINE_SIGNIFICANCE;
}

/** The certain (not probabilistic) cost of a card leaving your hand for good: brisque value
 * (scaled by how much brisques currently matter) if it's a brisque, plus the trump-
 * conservation cost if it's a trump. Used when the outcome is already known (losing a
 * follow), as opposed to `riskEstimator`, which is for leads/discards where whether the
 * card gets captured is still uncertain. */
function certainSurrenderCost(state: GameState, playerId: PlayerId, card: Card): number {
  let cost = 0;
  if (isBrisqueCard(card)) cost += state.ruleset.brisqueValue * brisqueSignificance(state, playerId);
  if (state.trumpSuit !== null && card.suit === state.trumpSuit) {
    cost += trumpConservationValue(state.players[playerId].hand, state.trumpSuit);
  }
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

/** Discount applied to speculative (not-yet-achievable) meld progress — see
 * docs/ai-strategy-notes.md for the sourced reasoning behind this shape. */
const SPECULATIVE_MELD_DISCOUNT = 0.25;

/** Bezique-family kinds in ascending classRank order — index i scores (i+1) Q♠/J♦ pairs. */
const BEZIQUE_FAMILY_KINDS: readonly MeldKind[] = ['bezique', 'doubleBezique', 'tripleBezique', 'quadrupleBezique'];

function bezikeFamilyPointsForPairs(ruleset: Ruleset, pairs: number, trumpSuit: Suit | null): number {
  if (pairs <= 0) return 0;
  const kind = BEZIQUE_FAMILY_KINDS[Math.min(pairs, BEZIQUE_FAMILY_KINDS.length) - 1]!;
  return meldPoints(ruleset.meldTable[kind]!, undefined, trumpSuit);
}

/**
 * Speculative value of a Q♠ or J♦ card toward the Bezique family, by PAIR count rather
 * than the generic per-slot fraction the rest of speculativeMeldValue uses. Every tier
 * needs a matched pair of both cards — holding several spare Jacks with zero Queens isn't
 * partial progress at all, since you can't score anything until you have at least one of
 * both. The generic "how many remaining slots are filled" calculation can't see that: it
 * priced 2 spare Jacks and 0 Queens as "14% of the way to Quadruple Bezique" (a real
 * reported bug — the 4,500-point combo's size made even a tiny fraction dwarf every other
 * card in the evaluation).
 *
 * Instead: only the card that's actually the CURRENT BOTTLENECK (removing it would lower
 * min(Q♠ count, J♦ count)) gets credit, priced at the tier that many pairs would reach.
 * A spare beyond what the other side supports contributes nothing — which also correctly
 * produces the sourced "chase the third and fourth Bezique hard once you're already
 * holding two" shape: the bottleneck side is whichever you have fewer of.
 */
function bezikeFamilySpeculativeValue(state: GameState, playerId: PlayerId, card: Card): number {
  const isQS = card.suit === 'S' && card.rank === 'Q';
  const isJD = card.suit === 'D' && card.rank === 'J';
  if (!isQS && !isJD) return 0;

  const hand = state.players[playerId].hand;
  const totalQS = hand.filter((c) => c.suit === 'S' && c.rank === 'Q').length;
  const totalJD = hand.filter((c) => c.suit === 'D' && c.rank === 'J').length;
  const pairsWith = Math.min(totalQS, totalJD);
  const pairsWithout = Math.min(totalQS - (isQS ? 1 : 0), totalJD - (isJD ? 1 : 0));
  if (pairsWithout >= pairsWith) return 0; // not the bottleneck — a genuine spare

  return bezikeFamilyPointsForPairs(state.ruleset, pairsWith, state.trumpSuit) * SPECULATIVE_MELD_DISCOUNT;
}

/**
 * Credit for a card that partly builds toward a meld it isn't part of an achievable
 * combination for yet — e.g. holding 2 of the 4 Aces needed for Four Aces, or an extra
 * same-suit card once a Marriage is already down (real strategy advice: "if you already
 * have a King and Queen of the same suit, hold onto other cards from that suit"; "chase
 * the third and fourth Bezique hard if you're already holding two" — the steep 500/1,500/
 * 4,500 curve falls out naturally here since bigger melds score proportionally more even
 * at the same completion fraction). A card with zero other supporting cards already in
 * hand gets nothing — the sourced advice is about extending existing partial progress, not
 * a blanket "hold all court cards" heuristic (what this project used before the shared
 * evaluator existed, and which overvalued genuinely unsupported cards).
 */
function speculativeMeldValue(state: GameState, playerId: PlayerId, card: Card): number {
  const hand = state.players[playerId].hand;
  const ruleset = state.ruleset;
  let best = bezikeFamilySpeculativeValue(state, playerId, card);

  for (const kind of Object.keys(ruleset.meldTable) as MeldKind[]) {
    const def = ruleset.meldTable[kind]!;
    // The Bezique family (Q♠+J♦, repeated 1-4 times) is handled separately below — see
    // bezikeFamilySpeculativeValue for why the generic per-slot fraction below doesn't fit it.
    if (def.class === 'bezique') continue;
    // Trump-scoped quartets (Chinese Bezique) only ever resolve against the CURRENT trump
    // suit, not an arbitrary/undefined one — passing undefined would make every slot's suit
    // undefined too, so it could never match a real hand card and would silently always
    // contribute zero. With no trump set yet, there's nothing valid to check at all.
    const suitsToCheck =
      def.class === 'sequence'
        ? [card.suit]
        : def.suitScope === 'trump'
          ? state.trumpSuit !== null
            ? [state.trumpSuit]
            : []
          : [undefined];
    for (const suit of suitsToCheck) {
      const slots = requiredSlots(ruleset, kind, suit);
      const selfSlotIndex = slots.findIndex((s) => s.suit === card.suit && s.rank === card.rank);
      if (selfSlotIndex === -1) continue; // this meld kind doesn't involve this card at all

      const remainingSlots = [...slots];
      remainingSlots.splice(selfSlotIndex, 1);

      const usedHandIds = new Set<string>([card.id]);
      let supportingCount = 0;
      for (const slot of remainingSlots) {
        const match = hand.find((c) => c.suit === slot.suit && c.rank === slot.rank && !usedHandIds.has(c.id));
        if (match) {
          supportingCount++;
          usedHandIds.add(match.id);
        }
      }
      if (supportingCount === 0) continue; // no partial progress — not what the sourced advice supports
      // A supporting count that already covers every remaining slot means this combination
      // is FULLY assembled from other hand cards right now — not "partial progress toward"
      // anything. That's either genuinely fresh and freshly declarable (meldForfeitCost
      // already prices it at full, undiscounted value) or it's the exact combination of an
      // already-declared meld the player is still holding (blocked from fresh redeclaration
      // by the class-reuse rule, and correctly worth 0 here — there's no real future scoring
      // left in it). Without this, a card sitting in an already-declared, fully-intact meld
      // (e.g. a King from a standing Four Kings) got priced as if breaking it up cost real
      // points, when the points are already permanently banked regardless of what happens
      // to the cards afterward.
      if (supportingCount >= remainingSlots.length) continue;

      const fraction = supportingCount / remainingSlots.length;
      const value = meldPoints(def, suit, state.trumpSuit) * fraction * SPECULATIVE_MELD_DISCOUNT;
      if (value > best) best = value;
    }
  }

  return best;
}

/** Discount applied to "spare" value — see docs/ai-strategy-notes.md. */
const SPARE_REPLACEMENT_DISCOUNT = 0.3;

/**
 * Value of holding a card that could refresh an ALREADY-declared meld once one of its
 * cards is eventually played away — the replacement re-declaration mechanic (rules spec
 * §3). Sourced: "hold spare Kings/Queens/Aces in hand so you can pull one out to a trick
 * and slot a duplicate straight back in for another full score"; "if you hold both Kings
 * and both Queens of a suit... you can declare one marriage now, and later re-pair the
 * spares into a second marriage" (docs/ai-strategy-notes.md). Discounted since it depends
 * on a card from the original meld actually being played first, not yet a sure thing.
 */
function spareForReplacementValue(state: GameState, playerId: PlayerId, card: Card): number {
  const player = state.players[playerId];
  let best = 0;
  for (const meld of player.melds) {
    if (meld.cardIds.includes(card.id)) continue; // already part of this meld, not a spare
    const slots = requiredSlots(state.ruleset, meld.kind, meld.suit);
    const matchesASlot = slots.some((s) => s.suit === card.suit && s.rank === card.rank);
    if (!matchesASlot) continue;
    const value = meld.points * SPARE_REPLACEMENT_DISCOUNT;
    if (value > best) best = value;
  }
  return best;
}

/**
 * How much a candidate trump suit favours this hand — used only when a declareMeld move
 * would establish trumps for the rest of the hand (the first marriage/sequence declared).
 * A bigger hand presence in the suit means more useful trumps throughout, and spare
 * court cards support the re-declaration fishing above. Sourced: "wait until you can
 * nominate trumps in the suit where your hand is strongest (ideally where you're building
 * toward a sequence or hold spare court cards)" (docs/ai-strategy-notes.md).
 */
const TRUMP_CANDIDATE_BONUS_PER_SPARE_CARD = 4;

function trumpCandidateStrength(state: GameState, playerId: PlayerId, suit: Suit): number {
  const hand = state.players[playerId].hand;
  const suitCount = hand.filter((c) => c.suit === suit).length;
  return Math.max(0, suitCount - 2) * TRUMP_CANDIDATE_BONUS_PER_SPARE_CARD;
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
    // Mirror moves.ts's applyDeclareMeld: a marriage/sequence that ESTABLISHES trump (the
    // first one declared) scores at the trump rate immediately, not the plain rate this
    // move would otherwise be priced at while trumpSuit is still null. Getting this right
    // matters doubly here: it's the true value, and it's also what lets different candidate
    // suits be compared at all — before this fix every untrumped marriage looked identical.
    const establishesTrump = state.trumpSuit === null && (move.meldKind === 'marriage' || move.meldKind === 'sequence');
    const def = state.ruleset.meldTable[move.meldKind]!;
    const points =
      establishesTrump && def.class === 'sequence' && chosen ? def.trumpPoints : (chosen?.points ?? 0);
    meldProgress = points;
    if (establishesTrump && chosen?.suit) {
      meldProgress += trumpCandidateStrength(state, playerId, chosen.suit);
    }
    // Declaring reveals cards to the opponent — bigger melds give away more.
    informationGivenAway = -Math.min(points * 0.05, 5);
  } else if (move.type === 'pass') {
    const options = findAllDeclarableMelds(state.ruleset, hand, player.melds, state.trumpSuit, state.cardMeldClassUsage);
    const best = options.length > 0 ? Math.max(...options.map((o) => o.points)) : 0;
    meldProgress = -best;
  } else {
    const card = findCardById(hand, move.cardId);
    const forfeitCost = meldForfeitCost(state, playerId, card.id);
    const speculativeValue = speculativeMeldValue(state, playerId, card);
    const spareValue = spareForReplacementValue(state, playerId, card);
    meldProgress = -Math.max(forfeitCost, speculativeValue, spareValue);

    if (state.stage === 'awaitingFollow' && state.currentTrick.leadCard) {
      const leadCard = state.currentTrick.leadCard;
      const wins = wouldBeatLead(card, leadCard, state.trumpSuit);
      if (wins) {
        const significance = brisqueSignificance(state, playerId);
        const captured =
          significance *
          ((isBrisqueCard(leadCard) ? state.ruleset.brisqueValue : 0) + (isBrisqueCard(card) ? state.ruleset.brisqueValue : 0));
        // Small flat bonus for winning (gains the lead + a meld window), and a tiny
        // preference for the cheapest winning card when several would all win.
        trickValue = captured + 5 - rankValue(card.rank) * 0.01;
      } else {
        // A definite loss: give up the least by discarding the card with the smallest
        // surrender cost, and among equal-cost options (typically several low, non-trump,
        // non-brisque cards worth nothing at all), prefer shedding the lowest rank first.
        trickValue = -certainSurrenderCost(state, playerId, card) - rankValue(card.rank) * 0.01;
      }
    } else {
      // Leading, or an unconstrained main-phase discard: no trick to resolve yet,
      // just an exposure/conservation estimate. (Endgame leads get a more precise
      // treatment via simulated lookahead in weightedAgent.ts, since the opponent
      // is constrained there in ways this flat estimate doesn't model.)
      let exposure = 0;
      if (isBrisqueCard(card)) {
        exposure += state.ruleset.brisqueValue * riskEstimator(state, playerId, card) * brisqueSignificance(state, playerId);
      }
      if (state.trumpSuit !== null && card.suit === state.trumpSuit) {
        // Trumps are worth conserving even when they aren't brisques, and independently of
        // how much brisques currently matter: they're the only cards that can win a trick
        // off-suit, and they're needed for a trump marriage/sequence.
        exposure += trumpConservationValue(hand, state.trumpSuit);
      }
      // Tiny tiebreak (same epsilon scale as the follow branches above): when two leads are
      // otherwise identical in every real factor — e.g. two low, non-trump, non-brisque, non-
      // meld-relevant cards — prefer to shed the lower rank first and keep the higher one,
      // which has more latent chance of pairing into a future meld. Without this, ties fell
      // back to hand order (deal order), which looked arbitrary to a player comparing options.
      brisqueRisk = -exposure - rankValue(card.rank) * 0.01;
    }
  }

  const total =
    trickValue * weights.trickValue +
    meldProgress * weights.meldProgress +
    brisqueRisk * weights.brisqueRisk +
    informationGivenAway * weights.informationGivenAway;

  return { trickValue, meldProgress, brisqueRisk, informationGivenAway, total };
}
