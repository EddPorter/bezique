# Ideas backlog

Running list of things to work through. Not build-order steps (see PROJECT-BRIEF.md
for those) — this is for side ideas, debugging tooling, and open questions raised
during play-testing.

## Open

1. **Hand ordering** — should cards in hand be manually reorderable (drag), auto-sorted
   (by suit/rank), or a choice between the two? Needs a design decision.
2. **Debug: dump live game state from code** — a way to serialize/inspect the current
   `GameState` while developing, without going through the UI.
3. **Debug: reconstruct a hand in the browser** — the inverse: load a specific hand/state
   into a live game for testing a scenario directly, instead of playing up to it.
4. **Better live-testing approach for Claude** — move off "always click the first legal
   move" during automated browser verification. Largely unblocked by #2/#3: if a specific
   scenario can be constructed directly, there's much less need to drive a full random
   playthrough to reach it.
5. **Step 7: cheat mode** — next item in the PROJECT-BRIEF.md build order.
6. The tutor checkbox is cut off. Happened when "Insights" checkbox was added.
   Maybe the checkboxes should be on their own line underneath the difficulty chooser.

## Resolved

- **Bezique → Double Bezique upgrade scoring** — both count (40 + 500 = 540 total).
  Confirmed 2026-08-13: each declaration scores independently and additively
  (`moves.ts` never retracts a prior meld's points); the class-reuse rule treats moving
  *up* within a class as cumulative, matching `ai-strategy-notes.md`'s "declare early,
  then upgrade" guidance.
