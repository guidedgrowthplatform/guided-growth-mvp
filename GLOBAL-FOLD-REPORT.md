# Global layer fold report

## Scope completed

- Rendered behavioral rules: **26** (`GR-01` through `GR-26`)
- Rendered locked reactive slots: **8**
- Rendered amended contracts: **5**
- Provenance header rendered verbatim: `PROPOSED FULL SET, pending the blessing; behavior unverified; activation blocked`
- Each `enforcedBy` chip includes its audit status: `REAL`, `PARTIAL`, or `NOT-IMPLEMENTED`.
- Reactive slots show their slot ID and response rows, including the pending asset/recording state.

## Source and boundaries

- Global display data lives in `src/components/flow-designer/globalLayer.ts`.
- The display is rendered by `src/components/flow-designer/FlowDesigner.tsx`.
- No beat-level entries in `src/components/flow-designer/beatsSource.ts` were changed.
- `flowBible.ts` remains types-only.
- The global layer is explicitly proposed and blocked from activation; this work does not claim runtime behavioral enforcement.

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
✓ built in 7.26s
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

Result: **passed** — verifier confirms exactly the required two locked-copy deltas.
