# Classic (Plain) Bézique — Rules Specification (v1, research only)

**Status:** research complete, 2026-08-21 — no implementation yet. This document is the input for a future engine change; it does not describe anything currently built.
**Primary source:** *Hoyle's Games Modernized*, "Bézique" chapter, via Wikisource: <https://en.wikisource.org/wiki/Hoyle's_Games_Modernized/B%C3%A9zique> — the exact same primary source already cited for Rubicon Bézique's own rules-spec (its "Rubicon Bézique" section immediately follows the plain-Bézique section quoted below, on the same page).
**Secondary source:** H. Fosdick, 'Bezique and Variations', archived and revised by J. McLeod (Pagat.com, 2022), <https://www.pagat.com/marriage/Bezique_and_Variations.html> — the same source already cited for Chinese Bézique. Its "Bezique" section explicitly lists itself as a diff against its own "Marjolet" section (a smaller, single-pack, 6-card relative), so a couple of facts below are inherited from there rather than stated directly under "Bezique."

Cross-check: both sources independently give identical figures for deck size, deal size, and the full meld table (see §3) — strong agreement between an 1887-era primary text and a modern hobbyist compilation gives good confidence in the numbers below. Where the two sources actually conflict, it's flagged explicitly (§4).

---

## 0. Relationship to Rubicon and Chinese Bézique

Classic Bézique is the base game both later variants are built on. Direct quote, Hoyle's:

> "Bézique is a game for two players. The piquet pack of thirty-two cards is used, but in duplicate, two such packs of like pattern being shuffled together."

Rubicon Bézique's own rules-spec already notes the key structural difference: *"Each deal is a complete game (there is no running multi-deal match in Rubicon Bezique as there is in plain Bezique)."* This document confirms and sources that claim (§5) — it's the one structural difference that means Classic Bézique needs real new engine work (a match layer above the existing single-hand `GameState`), not just a new `Ruleset` config the way Chinese Bézique was.

## 1. Deck and deal

- Two 32-card French/piquet packs combined: **64 cards total**, two each of A, 10, K, Q, J, 9, 8, 7, in each suit. (Pagat: "Use two 32-card French decks... a duplicate set of cards, Ace down to 7.")
- Rank, high to low: A, 10, K, Q, J, 9, 8, 7 — identical to Rubicon/Chinese Bézique.
- Each player is dealt **8** cards (Hoyle: "by three, two, and three"; Pagat confirms 8, contrasted against Marjolet's 6).
- **Unlike Rubicon Bézique, a card IS turned up to set trumps at the deal**: the 17th card (Hoyle: "the seventeenth card being turned up by way of trump, and placed between the two players"). This is the opposite of Rubicon Bézique, where trumps are undetermined until the first marriage/sequence.
- If the turned-up trump card is a 7 (the dix), **the dealer immediately scores 10**.

## 2. The dix (seven of trumps) — has real value here, unlike Rubicon Bézique

Direct quote, Hoyle's:

> "The holder of the seven of trumps is entitled to exchange it for the turn-up card, at the same time scoring ten for it. The holder of the duplicate seven of trumps scores ten for it, but gains no further benefit thereby."

So: whoever holds the actual dix (the 7 of trumps) may, after winning a trick, trade it for the turned-up trump card and score 10 for doing so. Since two packs are combined, a *second*, duplicate 7 of trumps also exists in the deck somewhere — its holder can score the same 10 points when playing it, but gets no exchange privilege (the turn-up card is already gone by then). This is a genuinely different mechanic from Rubicon Bézique, which explicitly has **no** special dix value at all.

## 3. Turn structure

Direct quote, Hoyle's:

> "The non-dealer leads and the dealer plays to such lead any card he pleases. If he play a higher card... of the same suit, or a trump, he wins the trick; but he is not bound to do either, or even to follow suit... The winner of one trick leads to the next, but before doing so he marks any points to which his hand may entitle him... and draws one card from the top of the stock. His opponent draws a card in like manner."

Same shape as Rubicon Bézique's main phase: no suit-following requirement, winner declares (at most one meld — see below) then draws first, loser draws second, winner leads next.

## 4. Endgame — a real, sourced difference from Rubicon Bézique

Once the stock is exhausted, direct quote, Hoyle's:

> "No further declarations can be made... The mode of play as to these last eight tricks is according to Whist rules. Each player must now follow suit, if he can; if not, he is at liberty to trump."

**This does not say "must win if able."** It says only "follow suit if able; if unable, may trump" — standard Whist-style play, not the more decisive Rubicon Bézique endgame rule (which explicitly *does* require winning if able, per the Portland Club Laws already sourced in `bezique-rules-spec.md` §4).

**This conflicts with the secondary source.** Pagat's Bézique section inherits its endgame rule from its own Marjolet section by not listing it as a difference, and that section states: *"you must follow the suit led, if possible, and win the trick if possible. If you can not follow suit, you must trump if possible."*

Given this project's established practice of trusting a primary source over a secondary one where they conflict (exactly the same call already made for Rubicon Bézique's own class-reuse and tie-handling rules), **this document recommends following Hoyle's primary text: follow suit if able, trump if unable to follow suit, but no forced win.** This should be revisited if a better/older primary source turns up, and is flagged here explicitly rather than silently resolved.

The last trick is worth 10 points (not 50, as in Rubicon Bézique).

## 5. Match scoring — the structural difference

Direct quote, Hoyle's: *"The game is usually 1000 up, but, as the score proceeds by tens or multiples of ten, this number is pretty quickly reached."*

Pagat, unambiguously: *"A game across hands in two-deck Bezique is 1000 points"* (explicitly contrasted against Marjolet's 500).

**Both sources confirm: Classic Bézique is a running match across multiple deals, first to 1000 points wins** — unlike Rubicon Bézique, where "each deal is a complete game" (rules-spec.md §5) and unlike Chinese Bézique, which inherits that same one-deal-is-the-whole-game shape from Rubicon Bézique.

**Not explicitly stated by either source (inference, flagged):**
- Whether a deal that would otherwise still be running stops the instant a player's cumulative total crosses 1000, or plays out to its natural conclusion (stock exhausted + the final 8 forced tricks) before the match-level check happens. This document assumes the latter (each deal always plays to completion; the "has anyone reached 1000 yet" check happens between deals) — this matches the general shape of era card games and avoids an awkward "interrupt mid-trick" case, but neither source says so explicitly.
- Who deals next each new deal (presumably alternates, matching every other variant already implemented, but not directly stated for this specific game).
- What happens if a deal ends in an exact tie on melds+brisques (Rubicon Bézique's primary source explicitly voids the hand in this case — Law 61 — but that's Rubicon-specific text; nothing here confirms or denies the same rule for Classic Bézique's per-deal accounting).
- Brisques count toward the running total on every deal here (no "only count to break a near-tie" rule — that's a Rubicon Bézique-specific restriction). Hoyle's own scoring table lists brisques as a flat 10 points each, same category as every other declared score, with no conditional language.

These gaps would need either a better source or explicit judgement calls (flagged as such) before implementation.

## 6. Melds

Direct quote, Hoyle's scoring table (points):

| Meld | Points |
|---|---|
| The 7 of trumps, turned up by the dealer or declared by either player | 10 |
| The second (duplicate) 7 of trumps | 10 |
| The last (32nd) trick | 10 |
| Common Marriage — K+Q of any plain suit | 20 |
| Royal Marriage — K+Q of the trump suit | 40 |
| Single Bézique — Q♠ + J♦ | 40 |
| Double Bézique — the same combination again, fresh cards (**additional**, i.e. cumulative with the 40 already scored) | 500 |
| Four Knaves (Jacks), any suits | 40 |
| Four Queens | 60 |
| Four Kings | 80 |
| Four Aces | 100 |
| Sequence of the five best trumps — A, 10, K, Q, J | 250 |
| Brisques — every Ace or 10 captured in tricks, each | 10 |

Pagat's independently-compiled table matches every one of these figures exactly.

**Two real differences from Rubicon Bézique's meld table, both confirmed by both sources:**
1. **No Triple or Quadruple Bézique.** With only 2 combined packs (not 4), there are only ever 2 copies of Q♠/J♦ in play — Double Bézique (500) is the ceiling. This is a natural consequence of the smaller deck, not a separate rule.
2. **Sequence exists only for trumps (250) — there is no plain-suit Sequence at all.** Rubicon Bézique added a 150-point plain-suit Sequence option that has no equivalent here; Classic Bézique's Sequence is exclusively the trump-suit one.

**Same as Rubicon Bézique, confirmed directly by this primary source too** (so the existing engine's class-reuse implementation — `src/engine/melds.ts` — should need no changes for this rule specifically): the "upward-safe, downward-blocked" same-class reuse rule, quoted almost identically to the Portland Club Laws already sourced for Rubicon Bézique:

> "A card which has once scored cannot be again used to form part of a combination of the same kind... Neither can a card which has been declared in a given combination again be declared in a combination of an inferior order... though their having figured in a Marriage would be no bar to their subsequent use as part of a Sequence."

One meld may be declared per trick won, exactly as already implemented.

## 7. Implementation implications (summary for a future planning pass)

What would carry over from the existing engine unchanged:
- Deck/deal mechanics (`buildDeck`/`deal` are already fully generic over `deckCopies`/`cardsPerPlayer`/`ranks`/`suits`).
- Same-class meld reuse logic (`findFreshDeclarableMelds`'s class-rank check).
- The replacement re-declaration mechanic (Hoyle's text confirms the same substitution rule, not quoted in full above but present in the primary source).
- The core trick-resolution logic (`resolveTrick`) and main-phase no-suit-following rule.

What's genuinely new, not just config:
- **A turned-up trump card at deal time**, rather than trumps being undetermined until the first marriage/sequence — `dealNewHand` currently always sets `trumpSuit: null` at deal time; this variant needs `trumpSuit` set immediately from a dealt card.
- **The dix mechanic** (§2) — a new scoring event tied to a specific card and the turn-up, not represented by anything in the current meld/scoring model.
- **A different endgame legality rule** (§4) — `endgameLegalFollowCards` (`src/engine/trick.ts`) currently hard-codes "must win if able"; this variant needs "follow suit if able, otherwise may trump" without the forced-win requirement, which isn't currently expressible via `Ruleset` config at all.
- **A genuine multi-deal match wrapper** (§5) — the biggest item. Needs match-level state (cumulative score per player across deals, a target score, whose deal is next) sitting above the existing single-hand `GameState`, plus corresponding UI (a running match score display, "next deal" flow, match-end condition separate from hand-end).
- **No "only count brisques to break a tie" restriction** — brisques would need to count toward every deal's score unconditionally, which the current `finalizeScoring` doesn't support as a ruleset-level toggle.

This document deliberately stops at research — no plan for the above is proposed here.

## 8. Addendum: the odd stock (found during implementation, 2026-08-22)

Not part of the original research pass — surfaced by a random-play stress test once Classic
Bézique was actually implemented and wired up, the same kind already used for Rubicon and
Chinese Bézique.

With 64 total cards, 8 dealt to each of 2 players (16), and 1 more turned up as trump (§1),
the remaining stock is 64 − 16 − 1 = **47 cards — an odd number**. Every other implemented
variant's stock happens to be even (Rubicon: 128 − 18 = 110; Chinese: 192 − 24 = 168), so this
specific case was never exercised before. Since players draw one card each per trick (winner
then loser), an odd stock leaves exactly one card that can't be evenly split at the very end
of the drawing phase.

This turns out to be directly answered by the same primary source already cited throughout
this document. Hoyle's Games Modernized, "THE LAWS OF RUBICON BÉZIQUE" (Drawing), **Law 32**:

> "If there be an odd number of cards in the stock, the last card is not drawn."

That law is scoped to the Rubicon Bézique section specifically (where it's a dead rule in
practice, since Rubicon's own stock is always even) — but it describes the same physical
draw mechanic (winner draws, then loser draws, one card each) that Classic Bézique itself
uses, from the same source, so it applies here directly rather than needing a separate
invented house rule. Implemented in `drawStockForBothPlayers` (`src/engine/moves.ts`): once
fewer than 2 cards remain in the stock, nobody draws — the lone card is simply left aside.
