# Obvious Render Fixes Report

## Scope

- Viewer-only change: `src/components/flow-designer/FlowDesigner.tsx`.
- No beat data was changed. `beatsSource.ts` and locked onboarding copy remain untouched.

## Truncated text fixed

### Cause

The per-beat **Coach behavior context** rail section rendered `entry.context` in a `<pre>` with:

```ts
maxHeight: 260,
overflow: 'auto',
```

That 260px fixed cap made long context look abruptly cut off inside a collapsed rail section and provided no explicit reading cue. The global `GLOBAL_CONTEXT` contract was authored in `beatsSource.ts` but was not rendered in the annotated view at all.

### Fix

- Removed the `maxHeight` cap from coach-behavior context. The context now grows to its complete content instead of being silently clipped.
- Added wrapping (`overflowWrap: 'anywhere'`) to the context and rail table cells, so long content stays readable within the rail instead of disappearing outside it.
- Added a clearly labeled, expandable **“Global coach context and rules — expand to read all”** panel above annotated onboarding beats. It renders the entire `GLOBAL_CONTEXT` source unchanged.
- Audited all rail sections: no rail text block now uses a fixed height, line clamp, truncation, or hidden overflow. Long table values wrap rather than requiring hidden horizontal content.

## Missing data now rendered

The rail previously rendered only a subset of `BeatEntry` / `BibleSections`, leaving populated contract data invisible. The viewer now renders every populated per-beat section from `beatsSource.ts`:

- **Global context/rules:** `GLOBAL_CONTEXT` now appears in the expandable global panel above the rail.
- **Components:** `bible.components` now appears in the per-beat **Components** section, including rows, watch-outs, enforcement, and source status. This includes all weekly-projection frame contracts (registry key, controls/state, authoritative render contract/watch-out).
- **Identity:** `bible.identity` rows, aliases, watch-out, enforcement, and status now appear in **Identity**.
- **Script detail:** `bible.scriptMeta` reveal/timing rows already appear per script line; its section enforcement and status now appear below those lines.
- **Voice:** `bible.voice` rows, per-script-line resolution, assertion, enforcement, and status now appear in **Voice**.
- **Context prose:** `bible.contextProse` now appears in **Context prose**, including pending/status/enforcement metadata.
- **Persistence:** authored `bible.persistence` rows, watch-out, enforcement, and status now appear above raw `io.dataIn` / `io.dataOut` tables.
- **Tools:** allowed-tools note, status, and enforcement metadata now appear alongside tools, call rules, and specs.
- **Flow, edges, acceptance, applicable decisions:** their authored enforcement and source-status metadata now appear with their existing contract tables.
- **Render metadata:** remaining populated `BeatEntry` fields now appear in **Render metadata**: name, order, voice engine/mode, hide-orb, parent, named elements, spoken content, variable flag, opener mode, bubble behavior, and `perElement` mappings.
- **Section coverage:** `bible.sectionManifest` now appears in **Section coverage**, so every authored section’s filled/derived/N/A status is visible.

## Gate Results

Executed with Node `v22.23.1` after loading NVM:

```text
npm run type-check
> tsc --noEmit
PASS

npm run check:render
Render CONSISTENCY check passed: 62 beats, one source (beatsSource.ts).

npm run check:links
Render LINK-INTEGRITY check passed: 62 beats, all bindsTo elements + clips resolve.

npm run build:flow
✓ 2274 modules transformed.
✓ built in 6.82s
Wrote dist-flow/parity.json with 62 beats
Wrote dist-flow/_headers

npm run verify:objective1
locked-copy delta: onboarding-beat-6-profile:greeting.script[0].words
  old: "Good to meet you, {name}. Two quick things so I can tailor this to you."
  new: "Awesome {name}, two quick things so I can tailor this to you."
locked-copy delta: onboarding-beat-6-profile:asks.script[0].words
  old: "How old are you?"
  new: "How old are you, and how do you identify?"
Objective 1 verified: 62 beats, exactly 2 locked-copy deltas, rich contracts and coverage complete.
```

`build:flow` emitted only Vite’s existing large-chunk advisory; the build completed successfully.
