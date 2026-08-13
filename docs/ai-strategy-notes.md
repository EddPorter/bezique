# AI / tutor evaluation — strategy sources

**Status:** informs `src/agents/evaluation.ts`, not a rules document (see `bezique-rules-spec.md` for that).
**Consulted:** 12 August 2026.

## Sources

- H. Fosdick, 'Bezique and Variations' (Pagat.com) — <https://www.pagat.com/marriage/Bezique_and_Variations.html>. Already the project's primary rules source; also has general strategy notes ("it's always shrewd to use a scoring card in more than a single meld", memory/flexibility advice).
- 'How to Play Bezique – Rules, Melds and Strategy Guide' (card-games.ca) — <https://card-games.ca/traditional-card-games/bezique/>.
- 'Learn How To Play Bezique' (cardgameheaven.com) — <https://cardgameheaven.com/bezique/>.

Cross-referenced where possible; noted below where a claim comes from only one source.

## What's applicable to *this* ruleset, and what isn't

Several sources advise waiting to declare a smaller meld (e.g. a Marriage) until a bigger one sharing its cards (a Sequence) is known to be impossible. That advice assumes a ruleset where declaring the smaller meld first forfeits the cards for the bigger one later. **This project's primary rules source (the 1887 Portland Club code) explicitly allows the opposite** — a card scored in an inferior combination of a class can still go on to score a superior one (Marriage → Sequence, Single → Double/Triple/Quadruple Bezique), verified in `melds.ts` and covered by tests. So "wait for the bigger meld" isn't imported here — under this ruleset there's no forfeiture to wait out.

## Findings that did inform `evaluation.ts`

1. **Partial-progress speculative value.** "If you already have a King and Queen of the same suit, holding onto other cards from that suit might allow you to form a marriage or other high-value meld" (search-aggregated, corroborated by Pagat's "use a scoring card in more than one meld" framing). This is about *extending existing partial progress*, not assigning value to a card with zero support — a genuinely lone card (no matching King, no matching Jack) isn't specifically supported by the sourced advice, which is why the fix below only credits cards with at least one other supporting card already in hand, not every court card on principle (the old, pre-step-5 bespoke agent's flat "+20 for any court card" was the wrong shape of this idea).
2. **Brisque vs. marriage calibration.** cardgameheaven.com: "a brisque makes a difference of 20 points to the score, the same as a marriage." A captured brisque nets +10 to you and denies the opponent that same +10 — a 20-point swing on the differential, matching a common (20-pt) marriage. Used as a sanity check on `brisqueValue` (10/card) rather than a reason to change it — the existing win/lose branches already produce that ~20-point swing across the two outcomes of a single trick.
3. **Trump conservation is conditional.** card-games.ca: "trump cards are your endgame weapons," hold them generally. But cardgameheaven.com: "if you have long trumps, draw the opponents by playing them out" — hoarding has diminishing value once you're trump-heavy, and there's real benefit to depleting the opponent's trumps early. `TRUMP_CONSERVATION_VALUE` is now scaled down once a hand holds several trumps, rather than applied as a flat constant regardless of how many you have.
4. **Discard low, keep flexible.** "Low cards are the best discards"; "remain flexible in which melds you chase rather than fixating on a single goal." Already broadly consistent with the existing rank tiebreak and the fact that `evaluateMove` re-evaluates fresh on every call (no persistent "goal" state to fixate on) — no change needed here, noted for completeness.
