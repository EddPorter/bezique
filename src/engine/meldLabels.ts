import type { MeldKind } from './types.js';

/** Human-readable names for each meld kind. Single source of truth — the meld
 * choice/display UI and the generated help sheet all read from this. */
export const MELD_KIND_LABELS: Record<MeldKind, string> = {
  marriage: 'Marriage',
  sequence: 'Sequence',
  bezique: 'Bezique',
  doubleBezique: 'Double Bezique',
  tripleBezique: 'Triple Bezique',
  quadrupleBezique: 'Quadruple Bezique',
  fourAces: 'Four Aces',
  fourKings: 'Four Kings',
  fourQueens: 'Four Queens',
  fourJacks: 'Four Jacks',
};
