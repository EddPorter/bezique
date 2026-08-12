# Rubicon Bezique — Rules Specification (v1)

**Status:** draft for review
**Sources:** H. Fosdick, 'Bezique and Variations', archived and revised by J. McLeod (Pagat.com, 2022), <https://www.pagat.com/marriage/Bezique_and_Variations.html>, consulted 12 August 2026; 'Rubicon Bezique Card Game Rules' (whiteknucklecards.com), <https://whiteknucklecards.com/games/rubiconbezique.html>, consulted 12 August 2026, used to resolve the meld-reuse/re-declaration mechanics and the tie-break cascade that Pagat states only tersely or omits; h2g2 (BBC), 'Bezique - the Card Game', citing the Portland Club rules, consulted 12 August 2026, corroborating the brisques-only-count-for-ties/rubicon-avoidance rule as a third independent source. Cross-checked against Britannica's summary of standard (non-Rubicon) Bezique for the base game shape.

This document is the single source of truth for game logic, scoring, and the in-app help sheet. Where sources disagreed (see §7), I have picked the Pagat figures and flagged the alternative for you to confirm.

---

## 1. Deck and deal

- Four 32-card French decks combined and shuffled together: 128 cards total, four each of A, 10, K, Q, J, 9, 8, 7, in each of the four suits.
- Card rank (high to low): A, 10, K, Q, J, 9, 8, 7. Note the 10 ranks second, just below the Ace.
- Each player is dealt **9** cards (not 8, as in plain Bezique).
- No card is turned up to set trumps at the deal (unlike plain Bezique). Trumps are undetermined until the first marriage or sequence is scored (§3).

## 2. Basic turn structure

1. Non-dealer leads first. A trick consists of two cards, one from each player.
2. The second player is **not** required to follow suit during the main phase (i.e. while the stock has cards remaining).
3. The trick is won by the higher card of the suit led, or by any trump if the second card is a trump and the lead was not.
4. If identical cards are played to a trick, the card played first wins.
5. The trick winner may declare **one** meld (see §3), then draws the top card of the stock; the loser draws the next card. The trick winner leads the next trick.
6. This continues until the stock is exhausted.

## 3. Melds

A meld is declared by placing cards face-up in front of the declaring player immediately after winning a trick, one meld per trick won. Melded cards remain playable to later tricks and may be reused in a different *kind* of meld later (see meld-reuse rule below), but a card cannot score twice for the same kind of combination.

| Meld | Description | Points |
|---|---|---|
| Trump marriage | K + Q of the trump suit | 40 |
| Common marriage | K + Q of the same non-trump suit | 20 |
| Bezique | Q♠ + J♦ | 40 |
| Double bezique | Both Q♠ + both J♦ (all four cards, on table simultaneously) | 500 |
| Triple bezique | Three Q♠ + three J♦ | 1,500 |
| Quadruple bezique | All four Q♠ + all four J♦ | 4,500 |
| Trump sequence | A-10-K-Q-J of trumps together | 250 |
| Non-trump sequence | A-10-K-Q-J of a non-trump suit together | 150 |
| Four Aces | one of each suit | 100 |
| Four Kings | one of each suit | 80 |
| Four Queens | one of each suit | 60 |
| Four Jacks | one of each suit | 40 |
| Carte blanche | Dealt a hand with no court card (J/Q/K/A) at all | 50, re-declarable each time a fresh card is drawn without breaking the "no court card" condition |

**Trump determination:** the suit of the *first* marriage or sequence declared in the hand becomes trumps for the rest of the hand.

**The dix (seven of trumps):** unlike plain Bezique, the dix has **no special scoring value** in Rubicon Bezique.

**Meld classes and reuse:** melds fall into three classes — *Sequences* (trump/plain-suit sequences and marriages), *Quartets* (four-of-a-kind melds), and *Bezique* (bezique/double bezique). A card that has scored in a combination cannot be reused to score again in a **lower** combination of the *same class*, but it can be reused in a combination of a **different class** (higher or lower), and in a different class it can be scored more than once. Example: a Queen used in a Sequence may later be used in a Quartet, and later still in a Bezique — but a Queen used in a Marriage may not later be used in a Sequence (Marriage ranks below Sequence within the same class), though it can still go on to score in a Quartet or Bezique.

**Re-declaring melds by replacement (source: whiteknucklecards.com):** once at least one card of a declared combination has been played out to a trick, a player may reconstruct and re-score that same combination by pairing a "spare" card taken from *another* declared meld with the card(s) remaining from the depleted one — without needing a fresh card from hand.
- *Worked example (Quartet):* "Sixty Queens" (four Queens) is declared and scored. Later, one of those Queens is played to a trick, leaving three on the table. The player may then take a Queen from a different meld (e.g. a Marriage) and add it to the remaining three, re-forming and re-scoring "Sixty Queens" again.
- *Worked example (Marriage):* a player has declared several Marriages all in the same suit (i.e. holds spare Kings/Queens of that suit across melds). If one card of a Marriage is played to a trick, the player may take the "partner" card from a different, still-standing Marriage of the same suit and pair it with the remaining lone King or Queen, re-forming and re-scoring a Marriage — again without drawing from hand. This is the mechanic Pagat's page refers to more tersely as "two marriages of the same suit can be considered rearranged to form two more marriages," and is the same principle that applies to Bezique/Double Bezique.

This resolves the ambiguity flagged in the original draft — recommend implementing the general "replacement re-declaration" rule directly rather than a special-cased marriage-only rule, since it's the same mechanic across Sequences, Quartets, and Bezique.

## 4. Endgame (after the stock is exhausted)

- Once the stock runs out, all melded cards return to their owners' hands.
- For the remaining tricks, players **must** follow suit if able, and **must** win the trick if able (playing a trump if they cannot follow suit and cannot otherwise win). No further melds may be declared.
- Winning the **last trick** scores **50 points** (this replaces the 10-point value used in plain Bezique).
- **Brisques:** every Ace or 10 a player has captured in tricks over the course of the whole hand scores 10 points each — but see §7 on when brisques count.

## 5. End of hand / end of game scoring

Each deal is a complete game (there is no running multi-deal match in Rubicon Bezique as there is in plain Bezique).

1. Each player totals their points (melds + brisques as applicable) and **rounds down to the nearest 100**.
2. The player with the higher rounded total is the winner of the hand and scores a **500-point game bonus**, plus the numerical difference between the two players' rounded scores.
3. **Rubicon:** if the losing player failed to reach **1,000 points**, they are "rubiconed". In this case the winner's score instead becomes **1,000 plus the sum of both players' scores** (i.e. a much larger bonus than the normal 500 + difference).
4. Brisques (Aces/10s taken in tricks) are only counted towards a player's total in the event of a tie, or where counting them would prevent a rubicon — otherwise melds carry the hand. Now triple-sourced (Pagat, whiteknucklecards.com, and h2g2/Portland Club) — see §7.
5. **Tie-break cascade (source: whiteknucklecards.com):** if rounding down (step 1) produces a tie, count brisques for both players and round down again. If *that* still ties, the player with the higher actual (pre-rounding) score rounds **up** instead of down, guaranteeing a 100-point gap between the two totals. Quoting the source directly: "If the rounding down results in a tie, then brisques and Aces are counted at 10 each and the new totals rounded down. If this still produces a tie, then the player with the higher actual score rounds up, instead of down, to produce a difference of 100." This resolves the exact-tie case the original draft left open — no ties are possible under Rubicon Bezique's scoring once this cascade is applied, short of the two players' scores being numerically identical down to the last point (not addressed by any source, and not realistically reachable in play).

## 6. Structural note for implementation

Recommend representing this entire ruleset as a single config object (deck composition, meld table with point values and card requirements, endgame trigger conditions, rubicon threshold, game-bonus formula) rather than hard-coding it into engine logic. That's what lets a second variant (e.g. plain Bezique, or Chinese/Six-Pack Bezique) be added later as a new config rather than a rewrite of the engine, AI, or help sheet.

## 7. Open questions / ambiguities to confirm before implementation

Card-game rule sources disagree on some Rubicon-specific details more than they do for mainstream games — worth a deliberate decision rather than silently picking one:

- ~~**Brisques and scoring:** Pagat states brisques count only for ties/rubicon-avoidance, meaning melds dominate normal scoring. Some other sources (not as carefully sourced) imply brisques always count toward the running total.~~ **Resolved** — now triple-sourced: Pagat, whiteknucklecards.com, and h2g2 (citing the Portland Club rules) all agree brisques only count for ties/rubicon-avoidance. This materially affects AI strategy (an AI that undervalues brisques normally but must track them for endgame edge cases needs deliberately different logic than one that always cares about them) — see architecture plan §5.
- **Rubicon threshold:** Pagat gives 1,000 points for the standard 128-card Rubicon Bezique. One secondary source I found quoted 3,000–5,000, but that appears to conflate Rubicon Bezique with the larger Six-Pack/Eight-Pack variants (which do use higher thresholds — 3,000 for six-pack per Pagat). I've used 1,000 as canonical for our 128-card game.
- ~~**Marriage-rearrangement rule (§3):** stated tersely in the source; needs a concrete worked example agreed before coding.~~ **Resolved** — see the "re-declaring melds by replacement" mechanic in §3, now sourced with worked examples from whiteknucklecards.com's Rubicon Bezique page, consulted 12 August 2026. It generalises to a single rule ("replace a spent card from a standing meld and re-score") rather than a marriage-specific special case, which simplifies implementation.
- ~~**Exact ties after rounding:** the original draft didn't specify what happens if both players round down to the same total.~~ **Resolved** — see the tie-break cascade added to §5: round down, then count brisques and round down again if still tied, then let the higher pre-rounding score round up instead of down if a tie somehow persists. Sourced from whiteknucklecards.com, which is explicit about this cascade in a way Pagat isn't.

---

*Next: once you've confirmed §7, this becomes the input to the architecture plan (engine data model + move validation rules) and the in-app help sheet content.*
