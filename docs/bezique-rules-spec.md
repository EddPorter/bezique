# Rubicon Bezique — Rules Specification (v1)

**Status:** draft for review — revised 12 August 2026 against a primary source (see below); one correction reverses an earlier judgement call, flagged in §7.
**Primary source:** the 1887 Portland Club official code of laws for Rubicon Bézique, reproduced in full and numbered, in *Hoyle's Games Modernized*, via Wikisource: <https://en.wikisource.org/wiki/Hoyle's_Games_Modernized/B%C3%A9zique>, consulted 12 August 2026. This supersedes the secondary/hobbyist sources below wherever they conflict with it.
**Secondary sources:** H. Fosdick, 'Bezique and Variations', archived and revised by J. McLeod (Pagat.com, 2022), <https://www.pagat.com/marriage/Bezique_and_Variations.html>; 'Rubicon Bezique Card Game Rules' (whiteknucklecards.com), <https://whiteknucklecards.com/games/rubiconbezique.html>; both consulted 12 August 2026. Cross-checked against Britannica's summary of standard (non-Rubicon) Bezique for the base game shape.

This document is the single source of truth for game logic, scoring, and the in-app help sheet.

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

**Meld classes and reuse — verified against the 1887 Portland Club code (Laws 36–38):** melds fall into classes with an internal ranking — within the *Sequences* class, Marriage ranks below Sequence; within the *Bezique* class, Single < Double < Triple < Quadruple Bezique. **Quartets** (four-of-a-kind) are a separate class.

**The direction of the block is upward-safe, downward-blocked** — this is the opposite of what a plain reading of the summary prose on some hobbyist sites suggests, and it corrects a judgement call in an earlier draft of this document (see §7). The actual rule, quoted from the primary source:

> "A card declared in a given combination may not again be declared in an *inferior* combination of the same class — e.g. a king and queen declared in Sequence cannot be afterwards made available to score a Royal Marriage." (Law 37 / preceding note)

But critically, the *reverse* is explicitly permitted:

> "A player who has declared marriage may afterwards add the ace, ten, and knave of the same suit as the marriage, and declare sequence; or he may declare sequence without first declaring the marriage." (Law 36)

So: **Marriage → Sequence (upgrading within the class) is allowed. Sequence → Marriage (downgrading) is not.** The same logic applies to the Bezique class (Law 38): a card scored in a superior Bezique combination cannot be used to form an inferior one, but cards can be combined upward into a superior combination, and equal/superior combinations can still be formed with a substituted or added card. Cards can always move freely *between* classes (Sequence/Marriage ↔ Quartet ↔ Bezique) regardless of direction — the restriction is only ever within a single class, and only ever blocks moving down, never up.

**Re-declaring melds by replacement — verified against Laws 34, 35, and 38:** once a card of a declared combination has been played to a trick, a player may reconstruct and re-score that combination by substituting a card — either a fresh one from hand, or one borrowed from another standing meld — for the one that was played.

> "If a declared card be played, and a card which restores any scoring combination or combinations be substituted, these combinations may be declared again." (Law 34)

Marriages get a specific worked clarification (Law 35, and the explanatory note that follows it): if a player has declared two marriages in the same suit (so all four of that suit's King/Queen cards are on the table), playing one card frees them to re-pair the remaining three into a "new" marriage — which the source clarifies is not really a special case at all, just the general substitution rule applied twice over: "King 1 (already 'married' to queen 1) may again be married to queen 2; and king 2 ... to queen 1 in like manner." Quartets work the same way (example given for Four Queens in the general text). This is now a well-sourced mechanic, not a judgement call.

## 4. Endgame (after the stock is exhausted)

- Once the stock runs out, all melded cards return to their owners' hands.
- For the remaining tricks, players **must** follow suit if able, and **must** win the trick if able (playing a trump if they cannot follow suit and cannot otherwise win). No further melds may be declared.
- Winning the **last trick** scores **50 points** (this replaces the 10-point value used in plain Bezique).
- **Brisques:** every Ace or 10 a player has captured in tricks over the course of the whole hand scores 10 points each — but see §7 on when brisques count.

## 5. End of hand / end of game scoring

Each deal is a complete game (there is no running multi-deal match in Rubicon Bezique as there is in plain Bezique). This section is now verified against the primary source's Laws 56–61, which are more precise than the secondary sources and correct one detail from an earlier draft (the tie-handling in point 5 below).

1. Each player totals their meld points and **rounds down to the nearest 100** (brisques excluded at this stage — see point 4).
2. **Normal win (Law 57):** the winner is whoever has the higher rounded total. They score that difference, **plus a 500-point game bonus**. If the difference is less than 100, it is treated as exactly 100 (so the minimum possible win is 500 + 100 = 600).
3. **Rubicon (Laws 58–59):** if the loser's rounded score is below **1,000**, they are "rubiconed." Instead of subtracting, the winner's score becomes **the loser's rounded score plus the winner's own rounded score, plus 1,300** (this 1,300 is the 1,000-point rubicon game bonus plus a fixed 300 representing the brisques the winner is assumed to hold). If the rubiconed loser's own score is below 100, it's rounded *up* to 100 before adding, so a very weak loser still contributes at least 100 to the winner's total.
4. **Brisques (Law 56, 60, 61):** Aces and 10s captured in tricks score 10 points each, but — this is the important part — **they are only added to a player's total in two situations**: (a) when the melds-only scores are close enough that brisques would decide who wins at all (i.e. a near-tie), or (b) when a player's melds-only score is just below 1,000 but adding brisques would lift them to 1,000 and thereby save them from being rubiconed. Outside those two situations, brisques are tracked but never added — melds alone decide the winner and the margin.
5. **Exact ties (Law 61) — corrected from an earlier draft:** if, even after brisques are added under point 4, the two totals are still exactly equal, **the hand is null and void** — there is no forced tiebreak, no rounding-up mechanic. This replaces an earlier version of this document (based on a secondary source) which described a "round up instead of down" cascade; the primary 1887 code has no such rule and states plainly that a genuine tie voids the game. For the engine, this means a real, representable outcome state (`'void'`), not an error condition and not a forced winner.

## 6. Structural note for implementation

Recommend representing this entire ruleset as a single config object (deck composition, meld table with point values and card requirements, endgame trigger conditions, rubicon threshold, game-bonus formula) rather than hard-coding it into engine logic. That's what lets a second variant (e.g. plain Bezique, or Chinese/Six-Pack Bezique) be added later as a new config rather than a rewrite of the engine, AI, or help sheet.

## 7. Open questions / ambiguities — status

All items below are now resolved against the 1887 Portland Club primary source (§0, top of document). One resolution **reverses** a judgement call from the previous draft and needs to be corrected in the engine, not just documented — flagged clearly below.

- ~~**Marriage-rearrangement rule:**~~ **Resolved**, and now precisely sourced (Laws 34, 35, 38) rather than reasoned from a terse summary. See §3.
- ~~**Exact ties after brisques**~~ **Resolved, and corrected.** The previous draft, based on whiteknucklecards.com, described a "round up instead of down" tiebreak cascade. The primary source has no such rule: Law 61 states plainly that a genuine tie (even after brisques are counted) makes **the hand null and void**. This is a real outcome the engine needs to represent, not an edge case to paper over. See §5 point 5.
- ~~**Rubicon threshold:**~~ **Resolved and now quadruple-sourced** — 1,000 points, confirmed by the primary source's Laws 58–59 in addition to Pagat, whiteknucklecards, and h2g2.
- ~~**Brisques and scoring:**~~ **Resolved and precisely sourced** (Laws 56, 60, 61) — brisques are added only (a) to break a near-tie, or (b) to save a player from rubicon. See §5 point 4, which now also captures a detail missed before: a rubiconed loser's score under 100 is rounded *up* to 100 before being added to the winner's total (Law 59).
- **Same-class meld reuse — direction of the block. This reverses what's currently implemented and needs an engine fix, not just documentation.** The previous draft, based on whiteknucklecards.com's self-contradictory prose/example, concluded that reuse within a class was blocked in *both* directions. The primary source is unambiguous and internally consistent: reuse is blocked only **downward** (a card that scored in a Sequence cannot later score in a Marriage), while **upward** reuse is explicitly permitted and given as a worked mechanic (Law 36: a declared Marriage's cards can later be extended with the Ace/10/Jack of the same suit to score a Sequence too). Please pass this correction to Claude Code directly — the fix is specifically: allow a card already scored in a lower same-class combination to be reused in a higher one, while continuing to block the reverse.

---

*Next: once you've confirmed §7, this becomes the input to the architecture plan (engine data model + move validation rules) and the in-app help sheet content.*
