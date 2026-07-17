# Global layer fold v2 report

## Scope completed

The global display is now organized into **nine independently collapsible, topic-based sections** in `src/components/flow-designer/FlowDesigner.tsx`. Its display data lives in `src/components/flow-designer/globalLayer.ts`; `src/components/flow-designer/flowBible.ts` remains types-only, and no beat-level source changed.

The provenance header remains visible above all topics:

> PROPOSED FULL SET, pending the blessing; behavior unverified; activation blocked

## Per-section content counts

| Topic | Displayed content |
| --- | --- |
| 1. Authority, precedence, and safety | 2 rules: `GR-01`, `GR-03`; conflict semantics and provenance/activation warning. |
| 2. Coach output and conversation model | 5 rules: `GR-02`, `GR-04`, `GR-08`, `GR-20`, `GR-25`; 6 coach/conversation rows including multi-turn defaults and voice ownership. |
| 3. Current-beat input and picker behavior | 12 rules: `GR-06`, `GR-09`, `GR-10`, `GR-13`–`GR-19`, `GR-22`, `GR-23`; all 8 reactive slots grouped as trigger cards. |
| 4. Progress, state, and completion | 5 rules: `GR-05`, `GR-07`, `GR-21`, `GR-24`, `GR-26`; 6 data-passing/coach-boundary rows and 5 amended contract rows. |
| 5. Tool failure | `GR-12`; 4 retry/voice/text-or-tap/never rows, including `onboard_toolfail_voice`. |
| 6. Consumer contract | 6 adjacent implementation-contract rows: preview, playback, engine, coach, guards, and QA fleet. |
| 7. Enforcement registry | Full 33-row registry with `REAL`, `PARTIAL`, or `NOT-IMPLEMENTED` status from `ENFORCEMENT-AUDIT.md`; 3 retired-ID mappings. |
| 8. Canonical enums and data contracts | 2 canonical enum rows and all 10 resolved data contracts. |
| 9. Decisions and unresolved governance | All 10 historic decision rows plus 3 governance/activation rows; old decision library records no unresolved product item. |

## Enforcement status source

- `render-link-integrity-check` is the sole `REAL` registry entry.
- `advance-gate-check`, `tool-contract-check`, `audio-ownership-check`, `persistence-contract-check`, and `eval:parity-walk` are `PARTIAL`.
- The other 27 registry entries remain `NOT-IMPLEMENTED`.
- Rule cards retain their rule IDs and per-enforcer status chips.

## Boundaries preserved

- Display/data-module work only: no changes to `src/components/flow-designer/beatsSource.ts` or any beat-level rendering.
- Locked coach copy remains untouched.
- The objective verifier still reports exactly the two permitted locked-copy deltas.
- The display does not claim the proposed policy is active or behaviorally enforced.

## Gate outputs

### `npm run type-check`

```text
> life-growth-tracker@2.1.0 type-check
> tsc --noEmit
```

Result: **passed**.

### `npm run check:render`

```text
> life-growth-tracker@2.1.0 check:render
> node scripts/render-consistency-check.mjs

Render CONSISTENCY check passed: 62 beats, one source (beatsSource.ts).
```

Result: **passed**.

### `npm run check:links`

```text
> life-growth-tracker@2.1.0 check:links
> node scripts/render-link-integrity-check.mjs

Render LINK-INTEGRITY check passed: 62 beats, all bindsTo elements + clips resolve.
```

Result: **passed**.

### `npm run build:flow`

```text
> life-growth-tracker@2.1.0 build:flow
> vite build --config vite.flow.config.ts --base=/ && cp dist-flow/flow-standalone/index.html dist-flow/index.html && node scripts/export-render-parity.mjs

✓ 2275 modules transformed.
✓ built in 7.06s
Wrote dist-flow/parity.json with 62 beats
Wrote dist-flow/_headers
```

Result: **passed**. Vite emitted its existing chunk-size warning for a minified chunk over 500 kB; it did not fail the build.

### `npm run verify:objective1`

```text
> life-growth-tracker@2.1.0 verify:objective1
> node scripts/verify-objective1.mjs

locked-copy delta: onboarding-beat-6-profile:greeting.script[0].words
  old: "Good to meet you, {name}. Two quick things so I can tailor this to you."
  new: "Awesome {name}, two quick things so I can tailor this to you."
locked-copy delta: onboarding-beat-6-profile:asks.script[0].words
  old: "How old are you?"
  new: "How old are you, and how do you identify?"
Objective 1 verified: 62 beats, exactly 2 locked-copy deltas, rich contracts and coverage complete.
```

Result: **passed** — exactly the required two locked-copy deltas.
