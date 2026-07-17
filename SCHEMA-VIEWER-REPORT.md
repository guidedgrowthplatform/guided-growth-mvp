# Schema + Viewer Report

## Scope

Implemented the requested schema and Flow Designer rail updates without changing any beat contract values. `flowBible.ts` remains type-only; no `interruptible` or PipeCat voice-freedom values were added to `beatsSource.ts`.

## Changes

- `src/components/flow-designer/flowBible.ts`
  - Moved the canonical `ScriptLine` type to the type-only schema and added optional `interruptible?: boolean`.
  - Added optional conversation fields reserved for PipeCat integration:
    - `responseTimeMs?: number`
    - `endpointPatienceMs?: number`
    - `bargeInPolicy?: 'never' | 'after-first-sentence' | 'always'`
  - Added a short `RESERVED for the PipeCat integration.` doc comment to each voice-freedom field.

- `src/components/flow-designer/beatsSource.ts`
  - Imports and re-exports the canonical `ScriptLine` schema type for its existing public API.
  - No beat data values were changed or added.

- `src/components/flow-designer/FlowDesigner.tsx`
  - Renders each context/code rule's existing `enforcedBy` values as visible chips.
  - Adds a `Beat metadata` → `Enforcement` rollup line, deduplicated across all present Bible sections and rules for that beat.
  - Renames the `Resolved props` rail section to `Component inputs`; its key/value content is unchanged.
  - Renders `Interruptible` in each Script detail line: explicit `yes`/`no` when supplied, otherwise the existing-style `default` marker.
  - Renders PipeCat-reserved conversation fields only when they are present.

## Data / Copy Guardrails

- No `interruptible`, `responseTimeMs`, `endpointPatienceMs`, or `bargeInPolicy` values exist outside the schema/viewer declarations.
- No beat data changed.
- `verify:objective1` confirms exactly two locked-copy deltas remain:
  - `onboarding-beat-6-profile:greeting.script[0].words`
  - `onboarding-beat-6-profile:asks.script[0].words`

## Gates

All commands ran with Node `v22.23.1` after loading NVM.

```text
$ npm run type-check
> tsc --noEmit
PASS (exit 0)

$ npm run check:render
Render CONSISTENCY check passed: 62 beats, one source (beatsSource.ts).

$ npm run check:links
Render LINK-INTEGRITY check passed: 62 beats, all bindsTo elements + clips resolve.

$ npm run build:flow
✓ built in 6.88s
Wrote dist-flow/parity.json with 62 beats
Wrote dist-flow/_headers
PASS (exit 0)
Note: Vite reported its existing chunk-size advisory for a minified chunk over 500 kB.

$ npm run verify:objective1
Objective 1 verified: 62 beats, exactly 2 locked-copy deltas, rich contracts and coverage complete.
```

## Voice-Fields Delta (2026-07-17)

Added type-only, optional voice-pipeline fields to `flowBible.ts`; no values were added to `beatsSource.ts`.

- `ScriptLine.verbatim?: boolean` documents that exact wording must use live TTS, not a pre-rendered MP3.
- `BeatConversation` now supports optional turn detection, silence/turn limits, STT hints and vocabulary, and a rare TTS voice override.
- The Conversation rail renders each new per-beat field only when present; script rows render an explicit `verbatim` value only when present.
- The schema comment intentionally excludes Sonic 3.5 TTS speed/emotion, per-beat engine/provider selection, and unverified 429/MP3 fallback controls.

### Gate Run

Node: `v22.23.1`

```text
$ npm run type-check
> tsc --noEmit
PASS (exit 0)

$ npm run check:render
Render CONSISTENCY check passed: 62 beats, one source (beatsSource.ts).
PASS (exit 0)

$ npm run check:links
Render LINK-INTEGRITY check passed: 62 beats, all bindsTo elements + clips resolve.
PASS (exit 0)

$ npm run build:flow
✓ 2274 modules transformed.
✓ built in 6.91s
Wrote dist-flow/parity.json with 62 beats
Wrote dist-flow/_headers
PASS (exit 0)
Note: Vite emitted its existing chunk-size advisory for a minified chunk over 500 kB.

$ npm run verify:objective1
locked-copy delta: onboarding-beat-6-profile:greeting.script[0].words
  old: "Good to meet you, {name}. Two quick things so I can tailor this to you."
  new: "Awesome {name}, two quick things so I can tailor this to you."
locked-copy delta: onboarding-beat-6-profile:asks.script[0].words
  old: "How old are you?"
  new: "How old are you, and how do you identify?"
Objective 1 verified: 62 beats, exactly 2 locked-copy deltas, rich contracts and coverage complete.
PASS (exit 0)
```
