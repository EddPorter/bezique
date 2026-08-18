# Chinese (Six-Pack) Bezique — Rules Specification (v1)

**Status:** implemented, 2026-08-18.
**Source:** H. Fosdick, 'Bezique and Variations', archived and revised by J. McLeod (Pagat.com, 2022), <https://www.pagat.com/marriage/Bezique_and_Variations.html> — the "Chinese Bezique" section specifically. This is the same source already cited as a secondary reference for `bezique-rules-spec.md` (Rubicon Bezique).

Unlike the Rubicon Bezique spec, this one does **not** have a primary-source (Law-numbered) citation behind it — Chinese Bezique is documented here only via Pagat's summary. Where this doc states something as an inference rather than sourced fact, it's flagged explicitly.

---

## 0. Relationship to Rubicon Bezique

Quoted directly from the source:

> "6-pack or Chinese Bezique is played the same way as Rubicon Bezique (above) except for these rules changes—"

Everything not listed below (turn structure, meld-reuse class rules, endgame follow/win-if-able requirement, exact-tie voiding a hand, brisque significance rules) carries over unchanged from `bezique-rules-spec.md`.

## 1. Deck and deal

Quoted directly:

> "Use 6 decks of cards (A -> 7), 192 cards total. Each player is dealt 12 cards (instead of 9)."

- Six 32-card French decks combined: 192 cards total, six each of A, 10, K, Q, J, 9, 8, 7, in each of the four suits.
- Same rank order as Rubicon Bezique: A, 10, K, Q, J, 9, 8, 7.
- Each player dealt **12** cards.

## 2. Scoring number changes

Quoted directly:

> "Carte blanche scores 250 points each occurrence. The last trick scores 250 points as well."
>
> "A player is rubiconed if he fails to score 3,000 points. The rubicon bonus is 1,000 points."

- Carte blanche: **250** points (vs. 50 in Rubicon Bezique), same re-declarable-on-each-fresh-draw condition.
- Last trick bonus: **250** points (vs. 50).
- Rubicon threshold: **3,000** points (vs. 1,000).
- Rubicon bonus: **1,000** points (vs. 1,300) — the source doesn't break this down the way the Rubicon Bezique primary source does (1,000 game bonus + 300 assumed brisques), so it's implemented here as a flat 1,000 added the same way Rubicon Bezique's 1,300 is.

**Inferred, not stated by the source:** the normal-win game bonus (500), brisque value (10 per Ace/10), and round-to (100) aren't mentioned as different, so are carried over unchanged from Rubicon Bezique. The source frames the whole variant as a delta against Rubicon Bezique, which supports this reading, but it isn't something the source states outright either way.

## 3. New melds: trump quartets

Quoted directly:

> "Additional declarations are: 4 trump Aces = 1,000   4 trump 10's = 900   4 trump Kings = 800   4 trump Queens = 600   4 trump Jacks = 400"

These are **additional** to (not replacements for) the ordinary one-card-per-suit quartets (Four Aces/Kings/Queens/Jacks, unchanged from Rubicon Bezique at 100/80/60/40). A trump quartet is four copies of the *same* card, all in whichever suit is currently trump — only possible because the 6-pack has six copies of every card. It cannot be declared before a trump suit exists.

| Meld | Cards | Points |
|---|---|---|
| Four Trump Aces | 4 × Ace of trumps | 1,000 |
| Four Trump Tens | 4 × 10 of trumps | 900 |
| Four Trump Kings | 4 × King of trumps | 800 |
| Four Trump Queens | 4 × Queen of trumps | 600 |
| Four Trump Jacks | 4 × Jack of trumps | 400 |

Four Trump Tens has no ordinary-quartet counterpart at all (there's no "Four Tens" meld in either variant) — it's a wholly new combination, not an upgrade of anything.

**Meld class and reuse — inferred, not a cited rule.** The source doesn't state how (or whether) a card already scored in the plain quartet interacts with the trump quartet. This implementation treats the four trump-quartet kinds as belonging to the *same* class as the ordinary quartets (`quartet`), one classRank above them, so:

- A card scored in the plain quartet (e.g. Four Aces) *can* later be reused upward into the matching trump quartet (Four Trump Aces), scoring both, cumulatively — mirroring the already-sourced Marriage → Sequence pattern in Rubicon Bezique (`bezique-rules-spec.md` §3, Law 36).
- The reverse is blocked: a card already scored in the trump quartet cannot be used to freshly declare the plain quartet.

This is inferred from two things: (1) the general class-reuse shape already established and sourced elsewhere in this ruleset family, and (2) the source's own strategy note for this variant:

> "Another strategy is to obtain a 4-of-a-kind (preferably in Aces), re-score it many times, and hope to convert it to 4-of-a-kind in trumps (scored extra)."

"Convert... scored extra" only makes sense if the upgrade path is legal and additive — but this is this document's own reading of that sentence, not a directly quoted rule, and should be revisited if a better source turns up.

## 4. No quintuple or sextuple Bezique

Quoted directly:

> "...while there is scoring for triple and quadruple beziques, there is no score specifically for quintuple or sextuple beziques."

Even though 6 decks make up to 6 pairs of Q♠/J♦ possible, Quadruple Bezique (4,500 points, 4 pairs) remains the ceiling — a 5th or 6th pair scores nothing extra. Implemented by capping the Bezique-family pair-counting logic (`src/agents/evaluation.ts`) at 4 pairs, and simply not defining any higher tier in the meld table.

## 5. Structural note

Confirms the design goal already stated in `bezique-rules-spec.md` §6: this variant needed no change to the *shape* of a hand (still exactly one deal = one complete game, same trick/meld/draw cycle) — only a second `Ruleset` config object (`src/engine/chineseBezique.ts`) plus two small, genuinely new pieces of engine logic: a `suitScope: 'trump'` marker so a meld's required cards can resolve against whichever suit is currently trump instead of a fixed/looped-over suit, and switching `Ruleset.meldTable` from an exhaustive `Record` to a `Partial` one (Rubicon Bezique simply doesn't define the five trump-quartet kinds at all). Everything else — deck building, dealing, trick resolution, scoring, the tutor/AI evaluator, the help sheet — worked unchanged once those were in place.
