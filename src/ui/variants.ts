import { classicBezique, chineseBezique, rubiconBezique } from '../engine/index.js';
import type { Ruleset } from '../engine/types.js';

export interface VariantOption {
  name: string;
  ruleset: Ruleset;
}

/** Which ruleset config backs "New Game" (docs/PROJECT-BRIEF.md's variant-readiness goal:
 * a second ruleset should be additive, not a rewrite — this list is the whole UI-side cost). */
export const VARIANTS: VariantOption[] = [
  { name: 'Rubicon Bezique', ruleset: rubiconBezique },
  { name: 'Chinese Bezique', ruleset: chineseBezique },
  { name: 'Classic Bezique', ruleset: classicBezique },
];
