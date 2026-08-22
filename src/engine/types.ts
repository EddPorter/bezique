export type Suit = 'S' | 'H' | 'D' | 'C';

export type Rank = 'A' | '10' | 'K' | 'Q' | 'J' | '9' | '8' | '7';

/** A single physical card. `id` disambiguates the four duplicates of each Suit+Rank in a 128-card pack. */
export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export type PlayerId = 0 | 1;

export const OTHER_PLAYER: Record<PlayerId, PlayerId> = { 0: 1, 1: 0 };

/** The three reuse classes from rules spec §3. Carte blanche sits outside this hierarchy entirely. */
export type MeldClass = 'sequence' | 'quartet' | 'bezique';

export type MeldKind =
  | 'marriage'
  | 'sequence'
  | 'bezique'
  | 'doubleBezique'
  | 'tripleBezique'
  | 'quadrupleBezique'
  | 'fourAces'
  | 'fourKings'
  | 'fourQueens'
  | 'fourJacks'
  // Chinese/Six-Pack Bezique only (docs/chinese-bezique-rules-spec.md): four copies of the
  // SAME card in whichever suit is currently trump, enabled by the 6-pack's duplicates —
  // structurally different from the suit-per-card quartets above.
  | 'fourTrumpAces'
  | 'fourTrumpTens'
  | 'fourTrumpKings'
  | 'fourTrumpQueens'
  | 'fourTrumpJacks';

/** A meld as currently declared on the table. `cardIds` are the physical cards presently forming it. */
export interface MeldDeclaration {
  id: string;
  kind: MeldKind;
  class: MeldClass;
  suit?: Suit;
  cardIds: string[];
  points: number;
  declaredAtMoveIndex: number;
  lastScoredAtMoveIndex: number;
}

export interface Player {
  id: PlayerId;
  hand: Card[];
  melds: MeldDeclaration[];
  score: number;
  carteBlanchePoints: number;
}

export type GamePhase = 'dealing' | 'main' | 'endgame' | 'scoring' | 'complete';

/** Where we are within a trick/meld/draw cycle. `awaitingMeldDecision` only occurs during 'main'. */
export type GameStage = 'awaitingLead' | 'awaitingFollow' | 'awaitingMeldDecision';

export interface CurrentTrick {
  leaderId: PlayerId;
  leadCard: Card | null;
}

export type Move =
  | { type: 'playCard'; playerId: PlayerId; cardId: string }
  | { type: 'declareMeld'; playerId: PlayerId; meldKind: MeldKind; cardIds: string[] }
  | { type: 'pass'; playerId: PlayerId }
  /** Classic Bezique only (docs/classic-bezique-rules-spec.md §2): declare a held dix (7 of
   * trumps) during the same post-trick-win window as a meld. If the turn-up card hasn't
   * been claimed yet, this also exchanges it into the declarer's hand. */
  | { type: 'declareDix'; playerId: PlayerId; cardId: string };

export interface GameState {
  ruleset: Ruleset;
  deck: Card[];
  players: [Player, Player];
  trumpSuit: Suit | null;
  /** Classic Bezique only (trumpDetermination: 'turnedUpCard', docs/classic-bezique-rules-
   * spec.md §1/§2): the card revealed at deal time to set trumps, sitting on the table
   * separately from the stock. Null once no such card exists (Rubicon/Chinese Bezique) OR
   * once it's been claimed via the dix exchange. */
  turnUpCard: Card | null;
  phase: GamePhase;
  stage: GameStage;
  currentTrick: CurrentTrick;
  tricksWon: Record<PlayerId, Card[]>;
  /**
   * cardId -> for each meld class, the highest classRank that card has scored
   * a NEW (non-replacement) declaration at. Reuse within a class is blocked
   * only downward (rules spec §3, Portland Club Laws 36-38): a card may move
   * up to a superior combination of the same class, never back down to an
   * inferior one.
   */
  cardMeldClassUsage: Record<string, Partial<Record<MeldClass, number>>>;
  /** Classic Bezique only (docs/classic-bezique-rules-spec.md §2): physical dix (7 of
   * trumps) card ids that have already scored their one-time dix bonus, so a card can't be
   * declared twice — including a card that entered a hand via the exchange itself, which
   * must not be re-declarable even though it's "fresh" to that hand. */
  dixScoredCardIds: Record<string, true>;
  turn: PlayerId;
  dealerId: PlayerId;
  lastTrickWinnerId: PlayerId | null;
  history: Move[];
  result?: HandResult;
}

/** `void: true` means the hand was null and void (Law 61) — an exact tie even after brisques. No winner is declared. */
export type HandResult =
  | { void: true; winnerId: null; roundedScores: Record<PlayerId, number>; rubiconed: false; winnerFinalScore: null }
  | {
      void: false;
      winnerId: PlayerId;
      roundedScores: Record<PlayerId, number>;
      rubiconed: boolean;
      winnerFinalScore: number;
    };

export interface SequenceMeldDef {
  class: 'sequence';
  classRank: number;
  requiredCount: number;
  trumpPoints: number;
  plainPoints: number;
  /** Classic Bezique only (docs/classic-bezique-rules-spec.md §6): the Sequence exists ONLY
   * in the trump suit — there is no plain-suit version at all, unlike Rubicon/Chinese
   * Bezique's 150-point plain option. When true, findFreshDeclarableMelds skips every
   * non-trump suit entirely, so `plainPoints` is simply never read (still required on the
   * type rather than made conditional on this flag, for one unused field's sake). */
  trumpOnly?: boolean;
}

export interface FlatPointsMeldDef {
  class: 'quartet' | 'bezique';
  classRank: number;
  requiredCount: number;
  points: number;
  /** Chinese Bezique's trump quartets (fourTrumpAces etc.): the required slots resolve
   * against whichever suit is CURRENTLY trump, not a fixed or looped-over suit. Omitted
   * (undefined) for every ordinary suit-independent quartet/Bezique-family kind. */
  suitScope?: 'trump';
}

export type MeldDef = SequenceMeldDef | FlatPointsMeldDef;

/** Rubicon/Chinese Bezique: trumps are undetermined until the first marriage/sequence is
 * declared. Classic Bezique (docs/classic-bezique-rules-spec.md §1): a card is turned up
 * at the deal and sets trumps immediately. */
export type TrumpDetermination = 'firstMarriageOrSequence' | 'turnedUpCard';

/**
 * How a match ends. `singleHandComplete` (Rubicon/Chinese Bezique): each deal IS the whole
 * game, decided by the rounding/rubicon formula below. `cumulativeToTarget` (Classic
 * Bezique, docs/classic-bezique-rules-spec.md §5): a running match across MULTIPLE deals,
 * first to `targetScore` wins — a structurally different shape, not just different
 * numbers, which is why this is a discriminated union rather than one flat set of fields.
 */
export type MatchMode =
  | {
      kind: 'singleHandComplete';
      rubiconThreshold: number;
      gameBonus: number;
      /** Flat bonus added on top of both rounded scores when the loser is rubiconed (Laws 58-59): the 1,000-pt rubicon bonus plus a fixed 300 standing in for the winner's assumed brisques. */
      rubiconBonus: number;
      roundTo: number;
    }
  | {
      kind: 'cumulativeToTarget';
      targetScore: number;
    };

export interface Ruleset {
  deckCopies: number;
  cardsPerPlayer: number;
  ranks: readonly Rank[];
  suits: readonly Suit[];
  lastTrickBonus: number;
  brisqueValue: number;
  carteBlanchePoints: number;
  trumpDetermination: TrumpDetermination;
  /** Rubicon/Chinese Bezique endgame: must follow suit AND must win if able. Classic
   * Bezique (docs/classic-bezique-rules-spec.md §4, Whist-style): follow suit if able,
   * may trump if unable to follow suit, but no forced win — a real, sourced difference,
   * not an oversight. */
  endgameMustWinIfAble: boolean;
  /** Rubicon/Chinese Bezique: brisques only count toward the final score to break a
   * near-tie or rescue a rubicon. Classic Bezique: brisques count unconditionally, every
   * deal (docs/classic-bezique-rules-spec.md §5). */
  brisquesAlwaysCount: boolean;
  /** The dix (7 of trumps) special value (docs/classic-bezique-rules-spec.md §2).
   * Undefined means no such mechanic exists — Rubicon/Chinese Bezique explicitly have none. */
  dix?: { points: number };
  matchMode: MatchMode;
  /** Partial: a ruleset only needs entries for the meld kinds it actually supports —
   * e.g. Rubicon Bezique has no fourTrumpAces entry at all, not a disabled/zero one. */
  meldTable: Partial<Record<MeldKind, MeldDef>>;
}
