# Bezique Web App — Architecture Plan (v1)

**Status:** draft for review
**Depends on:** `bezique-rules-spec.md`

---

## 1. Guiding principle

Separate the game into four layers that only talk to each other through narrow interfaces. This is the one decision that makes every one of your stated features (multiple AI tiers, training mode, tutor, cheat mode, and eventual online multiplayer) fall out cheaply instead of each requiring bespoke plumbing.

```
┌─────────────────────────────────────────────┐
│  UI shell (screens, menus, settings)         │
├─────────────────────────────────────────────┤
│  Renderer (cards, table, animation)          │  ← reads state, never mutates it
├─────────────────────────────────────────────┤
│  Agents (human input / AI / tutor advisor)   │  ← produce moves, never touch DOM
├─────────────────────────────────────────────┤
│  Rules engine (pure, serialisable, no DOM)   │  ← ground truth, from the rules spec
└─────────────────────────────────────────────┘
```

The engine is the only layer that knows the rules. Everything above it either *asks* the engine what's legal or *tells* the engine a move happened. Nothing above it is allowed to special-case rule logic — if the tutor needs to know whether a move is good, it asks the same evaluation function an AI opponent would use, not a copy of the rule.

## 2. Tech choice

**Engine: plain, framework-free JavaScript (or TypeScript).** This part has no DOM dependency at all, and it's the part most worth keeping portable — it needs to run unchanged in a test harness now, in the browser in v1, and potentially server-side (as the authority) in the multiplayer phase. No framework should ever leak into this layer.

**UI/renderer: React**, now that a framework's on the table. Reasoning:
- The architecture in §1 is already unidirectional (state → render, agents never touch the DOM) — that's exactly React's model, so we're not fighting the framework to get the separation we already wanted.
- **Framer Motion** (a React animation library) handles the fiddly part of your brief — dealing arcs, card flips, melds sliding into place, score count-ups — with a fraction of the hand-rolled animation code Canvas/SVG-from-scratch would need. Worth pulling in alongside React specifically for this.
- "No server backend required" is about the *runtime* (v1 needs no server to play), not about *build tooling* — a small Vite build step is fine and still produces plain static files you can open or host anywhere with no backend. I'll set up Vite for the dev/build workflow.
- TypeScript is worth using throughout given we're now pulling in tooling anyway — the engine in particular (meld provenance, legal-move generation) is exactly the kind of code that benefits from a type checker catching mistakes before runtime. Recommend TS for engine + UI both.

## 3. Core data model

All game state is a single plain, JSON-serialisable object — no classes with hidden internal state, no closures inside the state itself. This matters for three separate features you asked for:
- **Cheat mode** is then just "render opponent's hand too" — the engine already has full information at all times (nothing is ever *actually* hidden from the data structure, only from what the renderer chooses to draw). There is no special "reveal" code path to build or get wrong.
- **Training mode / tutor** can evaluate the *entire* true state, including what's left in the stock, without needing a parallel "AI's view of the world" data structure.
- **Multiplayer, later,** becomes: serialise this object, send the delta over a wire, apply it on the other end. If state weren't plain data, this would be a rewrite rather than an addition.

Sketch:

```
GameState {
  ruleset            // the config object from §6 of the rules spec — deck size, meld table, thresholds
  deck: Card[]        // remaining stock, order matters (top = next draw)
  players: [Player, Player]
  trumpSuit: Suit | null
  trickInProgress: { leadCard: Card|null }
  tricksWon: { [playerId]: Card[] }   // for brisque counting
  phase: 'dealing' | 'main' | 'endgame' | 'scoring' | 'complete'
  turn: playerId
  history: Move[]      // every move applied, in order — enables replay, undo, and tutor "what if" analysis
}

Player {
  id
  hand: Card[]
  melds: Meld[]        // each meld records WHICH physical cards, not just "a marriage exists"
  score: number
}

Meld {
  kind: 'marriage' | 'sequence' | 'quartet' | 'bezique' | ...
  cards: CardRef[]      // references, not copies — needed for the replacement re-declaration rule
  suit?: Suit
  scoredAt: moveIndex   // so "has a card from this meld been played since?" is answerable
}

Card { suit, rank, id }   // id disambiguates the four physical duplicates of, e.g., Q♠ in a 128-card pack
```

The one rule from the spec that pushes on this model is the **replacement re-declaration** mechanic (§3 of the rules spec): re-scoring a meld by pulling a spare card from a different standing meld. That requires the engine to track melds as references to specific physical cards (not just "player has a marriage"), and to know when a meld has been "broken" by one of its cards being played to a trick. The sketch above accounts for this; it's the trickiest part of the whole engine and worth writing dedicated tests against the two worked examples in the rules spec before building anything else.

## 4. Moves and legality

A `Move` is a small, serialisable action object — `{ type: 'playCard', card }`, `{ type: 'declareMeld', meldKind, cards }`, etc. The engine exposes:

- `getLegalMoves(state, playerId) → Move[]`
- `applyMove(state, move) → newState` (pure function — returns a new state, doesn't mutate)

Every agent (human UI, AI, tutor) only ever interacts with the engine through these two functions. This is what makes "how do I add a new AI difficulty" or "how do I add a human player over the network" additive rather than invasive — they're all just different sources of `Move` objects being fed to the same `applyMove`.

## 5. Agents: human, AI tiers, and tutor

Common interface:

```
Agent {
  chooseMove(state, legalMoves) → Promise<Move>
}
```

- **Human agent**: resolves the promise when the player clicks a card / meld button in the UI. Doesn't know any rules itself — the UI only ever offers the legal moves the engine already computed.
- **AI agents**: several implementations of the same interface, differing in the evaluation heuristic behind `chooseMove`. Structure I'd suggest — not separate code paths per tier, but one scoring function with tunable weights (how much to value an immediate trick vs. building toward a big meld vs. tracking brisques vs. remembering what's left in a shrinking stock), so that:
  - **Novice** — mostly legal-random, weak card memory, doesn't plan melds ahead.
  - **Club player** — sensible heuristics (takes brisques when cheap, prioritises marriages/bezique over four-of-a-kinds, doesn't sacrifice a big meld for a small trick).
  - **Expert** — tracks all seen cards (perfect memory of what's been played, since the engine state supports this for free via `history`), values the replacement re-declaration mechanic, does shallow look-ahead on endgame forced-follow tricks.
  This also gives you a **training mode** almost for free: it's just a low/mid-tier AI opponent paired with the tutor turned on for the human side.
- **Tutor**: not a move-chooser at all — it's a read-only advisor that runs the *same* evaluation function an AI agent would use, ranks the human's legal moves by it, and surfaces the top choice **with an explanation**, not just a score. This is a firm requirement, not a nice-to-have, which pushes on how the evaluation function itself is written: it needs to return a *structured breakdown* (e.g. `{ trickValue, meldProgress, brisqueRisk, informationGivenAway, total }`) rather than a single opaque number, so the tutor can turn the dominant factor into a plain-English reason — "keeps your Bezique alive," "this is your only brisque this trick," "holding this risks the King you need for a marriage." AI opponents can ignore the breakdown and just use `total`; the tutor is the one consumer that needs the components. Worth designing the evaluation function's return shape with this in mind from the start, rather than bolting explanation on after the fact.

## 6. Renderer and animation

Subscribes to state transitions (`applyMove` before/after, or an event log) and animates accordingly — card flying from hand to trick, meld cards sliding into a display row, score ticking up. The renderer never decides what's legal; it only ever draws what the engine already decided happened. Keep this strictly one-directional (state → render) rather than letting animation code poke at game state, or you'll fight bugs where the visual and logical state disagree.

Cheat mode, concretely: the renderer takes a `visibility` setting (`'normal' | 'cheat'`) and simply chooses whether to render opponent card backs or faces. No engine change needed.

## 7. Help sheet

Generated directly from `ruleset.meldTable` (the config object from the rules spec) rather than hand-written HTML — this guarantees the help sheet can never drift out of sync with what the engine actually enforces, and it's also what makes supporting a second variant later (plain Bezique, say) come with its help sheet for free.

## 8. Persistence (v1 scope)

`localStorage` only, for: opponent-difficulty preference, cheat/tutor/training toggles, maybe a simple running win/loss tally. No accounts, no server round-trip — consistent with "no backend required."

## 9. Structural notes for the "one day" multiplayer phase

Not building any of this now, but the layering above is specifically chosen so that, later:
- A `RemoteAgent` implementing the same `chooseMove` interface (that actually posts to a server and awaits a broadcast) slots in next to the human/AI/tutor agents without changing the engine.
- The engine's pure `applyMove(state, move) → newState` function is the natural candidate to run *authoritatively* on a server — the exact same function, unmodified, decides legality server-side as decides it client-side today.
- Accounts/rankings/tournaments are then a layer bolted on top of "a server that runs the engine and brokers moves between two `RemoteAgent`s," not a redesign of anything built in v1.

This is a structural note for later, not a task for now — flagging it so the phased plan in §10 doesn't accidentally paint you into a corner.

## 10. Phased build order

1. **Engine core** — deck/deal, trick resolution, meld declaration + the replacement re-declaration mechanic, scoring, rubicon/game-end. No UI at all; test via a plain console harness playing scripted move sequences against the two worked examples from the rules spec.
2. **Minimal playable UI** — static (non-animated) card rendering, click-to-play, one simple ("Club player" tier) AI opponent, full game loop playable start to finish.
3. **Visual polish and animation** — card graphics, dealing/trick/meld animations, table aesthetic (this is where the `frontend-design` skill comes in for visual direction).
4. **Help sheet**, generated from the ruleset config.
5. **Additional AI tiers** (Novice, Expert), sharing the weighted-evaluation approach in §5.
6. **Training mode and tutor**, built on the same evaluation function.
7. **Cheat mode** — should be close to trivial given §3/§6, mostly a settings toggle plus the renderer branch noted above.
8. *(Future, out of scope for now)* — networking layer, accounts, rankings, tournaments, per §9.

---

*Next: happy to start on step 1 (engine core) whenever you're ready — that's the part worth getting right before anything else, since the UI, AI, and tutor all sit on top of it.*
