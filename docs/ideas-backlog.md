# Ideas backlog

Running list of things to work through. Not build-order steps (see PROJECT-BRIEF.md
for those) — this is for side ideas, debugging tooling, and open questions raised
during play-testing.

## Open

1. **Hand ordering** — should cards in hand be manually reorderable (drag), auto-sorted
   (by suit/rank), or a choice between the two? Needs a design decision.
2. **Step 7: cheat mode** — next item in the PROJECT-BRIEF.md build order.

## Resolved

- **Bezique → Double Bezique upgrade scoring** — both count (40 + 500 = 540 total).
  Confirmed 2026-08-13: each declaration scores independently and additively
  (`moves.ts` never retracts a prior meld's points); the class-reuse rule treats moving
  *up* within a class as cumulative, matching `ai-strategy-notes.md`'s "declare early,
  then upgrade" guidance.
- **Debug: dump live game state from code** and **reconstruct a hand in the browser** —
  both done together via `window.__bezique` (dev builds only), see `src/ui/useGame.ts`
  and `src/engine/debugState.ts`.
- **Better live-testing approach for Claude** — unblocked by the above: scenarios can now
  be constructed directly via `makeDebugState` + `setState` instead of driving a random
  playthrough to reach them.
- **Tutor checkbox cut off** — the `.assist-toggles` row didn't wrap and the checkbox got
  flex-shrunk. Fixed with `flex-wrap` on the row and `flex-shrink: 0` on the toggles/select.
