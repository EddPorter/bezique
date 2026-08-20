# Bezique Web App — Project Brief

**Purpose of this document:** anchor for a new Claude Code session (or a returning one) to orient itself — full scope, what's decided, what order to build in, and where the detail lives. `bezique-rules-spec.md` and `bezique-architecture-plan.md` are the detailed companions; this is the summary that ties them together.

## What this is

A single-player Rubicon Bezique card game, playable entirely in the browser with no server backend. Written incrementally, with a structural eye towards an eventual (out of scope for now) online multiplayer phase with logins, rankings, and tournaments — see §9 of the architecture plan for exactly what that means for today's design decisions and what it doesn't.

## Full feature scope

**v1 (in scope now):**
- Rubicon Bezique rules engine, per `bezique-rules-spec.md`
- Several AI opponents at different ability tiers
- Card graphics and animation
- An in-app help sheet showing hand/meld values
- A training mode
- A cheat mode (reveal opponent's hand)
- A tutor that suggests and *explains* moves, toggleable
- All client-side, no accounts, no server

**Explicitly deferred (structural consideration only, not being built now):**
- Online multiplayer, logins, rankings, tournaments

## Key decisions made so far

| Decision | Choice | Why |
|---|---|---|
| Variant | Rubicon Bezique (128 cards, 4×32), plus Chinese/Six-Pack Bezique (192 cards, 6×32) as a second config-driven ruleset | See rules spec §0 for Rubicon sourcing; `chinese-bezique-rules-spec.md` for the second variant |
| Rubicon threshold | 1,000 points | Quadruple-sourced incl. the 1887 Portland Club primary source |
| Brisques scoring | Count only for tie-breaking / rubicon-avoidance | Confirmed by primary source (Laws 56, 60, 61); rubiconed loser's own score under 100 rounds up to 100 before adding (Law 59) |
| Exact-tie resolution | Round down → tie → count brisques, round down → still tied → **hand is null and void**, no winner | Corrected from an earlier secondary-source-based draft; primary source (Law 61) is explicit: a genuine tie voids the hand, no forced tiebreak — see rules spec §5/§7 |
| Same-class meld reuse | **Upward-safe, downward-blocked**: a card scored in an inferior combo (e.g. Marriage) can later score a superior one (Sequence) in the same class; the reverse is blocked | Reversed from an earlier draft based on ambiguous secondary-source prose; primary source (Laws 36–38) is unambiguous — see rules spec §3/§7 |
| Stack | React + TypeScript + Vite + Framer Motion | Engine stays framework-free and portable; UI benefits from React's state→render model matching our layering; Framer Motion for card/meld animation |
| Engine design | Single plain serialisable state object, pure `applyMove(state, move) → newState`, engine always has full information | Makes cheat mode, tutor, and future multiplayer additive rather than special-cased (architecture plan §1–4) |
| AI design | One weighted evaluation function per move, tiers = different weights, not different algorithms (revisit if needed) | Keeps tutor and AI sharing logic so they can't drift apart |
| Tutor requirement | Must explain *why*, not just *what* | Evaluation function returns a structured breakdown (trick value, meld progress, brisque risk, information given away), not a single opaque score — architecture plan §5 |

## Build order

1. ✅ Engine core (deck, deal, tricks, melds incl. replacement re-declaration, scoring) — TypeScript, no UI, console test harness against the worked examples in the rules spec
2. ✅ Minimal playable UI — React, one mid-tier ("club player") AI, full game loop. No animation yet (static card rendering); trick resolution is instant with no lingering "both cards visible" moment — both deferred to step 3.
3. ✅ Visual polish and animation — Framer Motion. `frontend-design` skill wasn't available in this environment, so this pass used ad hoc design judgment instead. Felt table, real card-face styling, shared-layoutId card movement, a UI-layer trick-resolution pause (engine itself still resolves instantly — see architecture plan §6), a new meld display row (previously missing from the UI entirely), and a score count-up. Found and fixed a real engine bug in the process: a still-standing meld could be freshly re-declared for points again without ever being broken (class-rank reuse check used `>=` instead of `>`).
4. ✅ Help sheet, generated from the ruleset config — `buildHelpSheetContent(ruleset)` (engine layer, framework-free, unit tested) derives the meld table, card requirements, and every scoring number from `rubiconBezique` itself (via the same `requiredSlots`/`meldPoints` the engine uses to validate and score), not hand-typed HTML. A second ruleset would get its help sheet for free. Rendered as a toggleable modal (`HelpSheet.tsx` + a Help button); opening it doesn't touch game state. Also deduped `SUIT_SYMBOL` and meld display names (previously copy-pasted across two components) into shared engine-layer constants (`cards.ts`, `meldLabels.ts`) while wiring this up.
5. ✅ Additional AI tiers — built the shared weighted-evaluation function from architecture plan §5 that step 2 had deliberately deferred (the old bespoke `ClubPlayerAgent` heuristic is gone; retired along with its tests). `evaluateMove(state, playerId, move, weights)` (`src/agents/evaluation.ts`) scores every move via one structured breakdown — `trickValue`, `meldProgress`, `brisqueRisk`, `informationGivenAway` — shared by all three tiers and ready for step 6's tutor to consume directly. `WeightedAgent` (`src/agents/weightedAgent.ts`) is one class configured by weights/randomness/card-memory/lookahead, never a different algorithm per tier: Novice (high randomness, low weights), Club Player (the old tier's behavior, now weight-driven), Expert (full weights, perfect-memory brisque-risk via an unseen-card-pool estimator, and a simulated 1-ply look-ahead for endgame leads using the real `applyMove`/`getLegalMoves`). In-session difficulty selector added to the UI so all three are actually reachable — persistence is step 8's job, not this one.
6. ✅ Training mode + tutor — the tutor (`src/agents/tutor.ts`) is a read-only advisor, never a move-chooser: it runs `evaluateMove` for every legal move (Expert's weights + card-memory risk estimator, since advice should reflect the strongest available judgement), ranks them, and turns the *weighted delta* between the top move and the runner-up into a plain-English reason ("wins the trick and captures a brisque", "keeps your meld options open", "Declare Bezique — worth 40 points") — comparative, not just descriptive, so it actually explains why this move over the alternatives. Verified live across all the explanation branches during an extended auto-played session. Training mode turned out to be exactly the "almost free" preset the architecture doc predicted: tutor on + Novice opponent, one checkbox in `useGame.ts`.
7. ✅ Cheat mode — genuinely trivial given the state model, as predicted: a "Cheat" checkbox in the side panel reveals the opponent's already-public `state.players[AI_ID].hand` face-up (suit+rank sorted, non-interactive) instead of card backs. No engine or agent changes — purely a display toggle in `App.tsx`.
8. *(Future)* multiplayer transport, accounts, rankings, tournaments

## Open items still to confirm

- None blocking — engine core (step 1) is ready to start.

## Where the detail lives

- `bezique-rules-spec.md` — full Rubicon Bezique ruleset, sourced and cross-checked, with worked examples for the trickiest mechanic (replacement re-declaration)
- `bezique-architecture-plan.md` — layering, data model, agent interface, phased build order, multiplayer-readiness notes
- `chinese-bezique-rules-spec.md` — second variant (2026-08-18), sourced against Pagat's "Bezique and Variations"; confirms the config-driven ruleset design worked as intended — see its §5 for exactly what did and didn't need engine changes
- `classic-bezique-rules-spec.md` — third variant, **research only, not yet implemented** (2026-08-21). The original game Rubicon/Chinese Bezique both evolved from — genuinely needs new engine work (a multi-deal match layer, a different endgame rule, a turned-up-trump dix mechanic), not just a new Ruleset config. See its §7 for exactly what would and wouldn't carry over.
