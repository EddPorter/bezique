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
  | { type: 'pass'; playerId: PlayerId };

export interface GameState {
  ruleset: Ruleset;
  deck: Card[];
  players: [Player, Player];
  trumpSuit: Suit | null;
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

export interface Ruleset {
  deckCopies: number;
  cardsPerPlayer: number;
  ranks: readonly Rank[];
  suits: readonly Suit[];
  rubiconThreshold: number;
  gameBonus: number;
  /** Flat bonus added on top of both rounded scores when the loser is rubiconed (Laws 58-59): the 1,000-pt rubicon bonus plus a fixed 300 standing in for the winner's assumed brisques. */
  rubiconBonus: number;
  lastTrickBonus: number;
  brisqueValue: number;
  roundTo: number;
  carteBlanchePoints: number;
  /** Partial: a ruleset only needs entries for the meld kinds it actually supports —
   * e.g. Rubicon Bezique has no fourTrumpAces entry at all, not a disabled/zero one. */
  meldTable: Partial<Record<MeldKind, MeldDef>>;
}
