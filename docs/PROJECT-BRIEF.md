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
| Variant | Rubicon Bezique (128 cards, 4×32) | See rules spec §0 for sourcing |
| Rubicon threshold | 1,000 points | Double-sourced (Pagat + whiteknucklecards) |
| Brisques scoring | Count only for tie-breaking / rubicon-avoidance | Same |
| Stack | React + TypeScript + Vite + Framer Motion | Engine stays framework-free and portable; UI benefits from React's state→render model matching our layering; Framer Motion for card/meld animation |
| Engine design | Single plain serialisable state object, pure `applyMove(state, move) → newState`, engine always has full information | Makes cheat mode, tutor, and future multiplayer additive rather than special-cased (architecture plan §1–4) |
| AI design | One weighted evaluation function per move, tiers = different weights, not different algorithms (revisit if needed) | Keeps tutor and AI sharing logic so they can't drift apart |
| Tutor requirement | Must explain *why*, not just *what* | Evaluation function returns a structured breakdown (trick value, meld progress, brisque risk, information given away), not a single opaque score — architecture plan §5 |

## Build order

1. Engine core (deck, deal, tricks, melds incl. replacement re-declaration, scoring) — TypeScript, no UI, console test harness against the worked examples in the rules spec
2. Minimal playable UI — React, one mid-tier AI, full game loop
3. Visual polish and animation (Framer Motion; consult the `frontend-design` skill for aesthetic direction)
4. Help sheet, generated from the ruleset config (not hand-written, so it can't drift from the engine)
5. Additional AI tiers
6. Training mode + tutor (built on the shared evaluation function)
7. Cheat mode (should be near-trivial given the state model)
8. *(Future)* multiplayer transport, accounts, rankings, tournaments

## Open items still to confirm

- None blocking — engine core (step 1) is ready to start.

## Where the detail lives

- `bezique-rules-spec.md` — full Rubicon Bezique ruleset, sourced and cross-checked, with worked examples for the trickiest mechanic (replacement re-declaration)
- `bezique-architecture-plan.md` — layering, data model, agent interface, phased build order, multiplayer-readiness notes
