# L1-2: Typed registries + one read path for beat meta

Lane: builder-to-engine (gg-spec/docs/fable-lane-builder-engine-2026-07-03.md). Ledger row L1-2.

## Why it was broken

1. `ADAPTER_REGISTRY` and `FROZEN_CARD_TYPES` were `Record<string, ...>` / `Set` of
   strings: adding a `FlowComponentType` (exactly what L1-5..L1-8 will do for the
   check-in and tour flows) compiled clean while the new type silently had no
   adapter and no freeze decision. The home-tour gap shipped this way.
2. `beatEngineMeta.ts` re-imported the generated JSON independently with an
   `as unknown as` cast, a second read path that bypassed useFlow's shape check,
   graph validation, and TS fallback. A bad generated file gave the engine one
   flow and the voice provider another.

## What changed

- `componentRegistry.tsx`: `ADAPTER_REGISTRY` is now `satisfies
Record<FlowComponentType, AdapterComponent | null>` with `'home-tour': null` as
  the one explicit no-adapter-yet entry (L1-8 fills it). `FROZEN_CARD_TYPES` is
  derived from `FROZEN_BY_TYPE satisfies Record<FlowComponentType, boolean>`; the
  exported `ReadonlySet` is unchanged in content (same 11 frozen types), so
  BeatView and consumers are untouched.
- `beatEngineMeta.ts`: reads `loadPublishedFlow().nodes` (the live, validated
  FlowDocument with its TS fallback) instead of re-importing the JSON. Legacy
  scatter fallback (CHAT_VAPI_BEAT_SCREENS / LOCAL_CAPTURE_BEATS) unchanged.

## Proof

- Demonstrated: appending a bogus type to `FlowComponentType` fails `tsc` in BOTH
  registries ("Property 'tsc-demo-bogus' is missing"); reverted, tsc clean.
- `grep -rln onboarding-beginner-v1.generated.json src` (non-test): only
  `useFlow.ts` remains — a single read path for beat meta.
- `npx tsc --noEmit` clean; `npx vitest run` 147 files / 1473 tests green
  (including beatEngineMeta.test.ts unchanged).

## Upstream prevention

New flow component types (check-ins, tour) cannot ship half-wired: the compiler
forces an adapter decision and a freeze decision per type, and the voice provider
can never disagree with the engine about which flow is live.
