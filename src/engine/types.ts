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
  | 'fourJacks';

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
  /** cardId -> meld classes that card has scored a NEW declaration in (replacement re-declarations don't add here). */
  cardMeldClassUsage: Record<string, MeldClass[]>;
  turn: PlayerId;
  dealerId: PlayerId;
  lastTrickWinnerId: PlayerId | null;
  history: Move[];
  result?: HandResult;
}

export interface HandResult {
  winnerId: PlayerId;
  roundedScores: Record<PlayerId, number>;
  rubiconed: boolean;
  bonus: number;
  winnerFinalScore: number;
}

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
}

export type MeldDef = SequenceMeldDef | FlatPointsMeldDef;

export interface Ruleset {
  deckCopies: number;
  cardsPerPlayer: number;
  ranks: readonly Rank[];
  suits: readonly Suit[];
  rubiconThreshold: number;
  gameBonus: number;
  lastTrickBonus: number;
  brisqueValue: number;
  roundTo: number;
  carteBlanchePoints: number;
  meldTable: Record<MeldKind, MeldDef>;
}
