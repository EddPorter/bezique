import { SUIT_SYMBOL } from './cards.js';
import { MELD_KIND_LABELS } from './meldLabels.js';
import { requiredSlots } from './melds.js';
import type { MeldKind, Ruleset } from './types.js';

export interface MeldTableRow {
  kind: MeldKind;
  label: string;
  cards: string;
  suitNote?: string;
  points: string;
}

export interface HelpSheetContent {
  totalCards: number;
  deckCopies: number;
  cardsPerPlayer: number;
  rankOrderHighToLow: string;
  meldTable: MeldTableRow[];
  /** Present only for matchMode.kind === 'singleHandComplete' rulesets (Rubicon/Chinese
   * Bezique) — each deal decides a winner via the rounding/rubicon formula. */
  rubiconThreshold?: number;
  gameBonus?: number;
  rubiconBonus?: number;
  roundTo?: number;
  /** Present only for matchMode.kind === 'cumulativeToTarget' rulesets (Classic Bezique)
   * — deals accumulate raw points toward this target across a running match. */
  matchTargetScore?: number;
  lastTrickBonus: number;
  brisqueValue: number;
  carteBlanchePoints: number;
  /** Classic Bezique only (docs/classic-bezique-rules-spec.md §1/§2): the turned-up trump
   * card, and the dix (7 of trumps) point value. Undefined for rulesets with no dix at all. */
  hasTurnUpCard: boolean;
  dixPoints?: number;
}

/** Marriage/sequence apply to any suit — shown with this one as a concrete example. */
const REPRESENTATIVE_SUIT = 'S';

const CLASS_DISPLAY_ORDER: Record<string, number> = { sequence: 0, bezique: 1, quartet: 2 };

function formatCards(ruleset: Ruleset, kind: MeldKind): { cards: string; suitNote?: string } {
  const def = ruleset.meldTable[kind]!;
  const isSuitParameterized = def.class === 'sequence';
  const isTrumpScoped = def.class !== 'sequence' && def.suitScope === 'trump';
  const isTrumpOnlySequence = def.class === 'sequence' && def.trumpOnly === true;
  const slots = requiredSlots(ruleset, kind, isSuitParameterized || isTrumpScoped ? REPRESENTATIVE_SUIT : undefined);
  const cards = slots.map((s) => `${s.rank}${SUIT_SYMBOL[s.suit]}`).join(' ');
  return {
    cards,
    suitNote: isTrumpOnlySequence
      ? 'shown in spades — actually whichever suit is currently trump; no plain-suit version exists'
      : isSuitParameterized
        ? 'shown in spades — any suit qualifies; trumps score more'
        : isTrumpScoped
          ? 'shown in spades — actually whichever suit is currently trump'
          : undefined,
  };
}

function formatPoints(ruleset: Ruleset, kind: MeldKind): string {
  const def = ruleset.meldTable[kind]!;
  if (def.class !== 'sequence') return `${def.points}`;
  return def.trumpOnly ? `${def.trumpPoints} (trumps only)` : `${def.trumpPoints} trump / ${def.plainPoints} plain`;
}

/**
 * Generates the help sheet directly from the ruleset config (architecture plan
 * §7) — point values and card requirements come from the same `meldTable` /
 * `requiredSlots` the engine uses to validate and score melds, so this can't
 * drift out of sync with what's actually enforced. A second ruleset (a plain
 * Bezique variant, say) gets its help sheet for free by calling this again.
 */
export function buildHelpSheetContent(ruleset: Ruleset): HelpSheetContent {
  const meldTable: MeldTableRow[] = (Object.keys(ruleset.meldTable) as MeldKind[])
    .map((kind) => {
      const { cards, suitNote } = formatCards(ruleset, kind);
      return {
        kind,
        label: MELD_KIND_LABELS[kind],
        cards,
        suitNote,
        points: formatPoints(ruleset, kind),
      };
    })
    .sort((a, b) => {
      const defA = ruleset.meldTable[a.kind]!;
      const defB = ruleset.meldTable[b.kind]!;
      if (defA.class !== defB.class) return CLASS_DISPLAY_ORDER[defA.class]! - CLASS_DISPLAY_ORDER[defB.class]!;
      return defA.classRank - defB.classRank;
    });

  const matchMode = ruleset.matchMode;

  return {
    totalCards: ruleset.deckCopies * ruleset.suits.length * ruleset.ranks.length,
    deckCopies: ruleset.deckCopies,
    cardsPerPlayer: ruleset.cardsPerPlayer,
    rankOrderHighToLow: ruleset.ranks.join(' > '),
    meldTable,
    ...(matchMode.kind === 'singleHandComplete'
      ? {
          rubiconThreshold: matchMode.rubiconThreshold,
          gameBonus: matchMode.gameBonus,
          rubiconBonus: matchMode.rubiconBonus,
          roundTo: matchMode.roundTo,
        }
      : { matchTargetScore: matchMode.targetScore }),
    lastTrickBonus: ruleset.lastTrickBonus,
    brisqueValue: ruleset.brisqueValue,
    carteBlanchePoints: ruleset.carteBlanchePoints,
    hasTurnUpCard: ruleset.trumpDetermination === 'turnedUpCard',
    ...(ruleset.dix ? { dixPoints: ruleset.dix.points } : {}),
  };
}
