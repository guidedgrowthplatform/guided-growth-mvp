# Phase B CI Gates Builder Report

## Delivered

- `gate:ids`: `scripts/gates/check-id-literals.mjs` scans runtime `api/` and `src/` for exact quoted canonical and legacy IDs loaded from `src/onboarding-flow/flows/onboarding-contract.v1.json`.
  - Configuration: `scripts/gates/config.mjs`.
  - Allowlist: generated crosswalk, `supabase/migrations/`, `docs/audits/`, and the analytics ID-remap note. Tests are intentionally scanned and never globally allowlisted.
- `gate:writers`: `scripts/gates/check-writers.mjs` scans `api/`, `src/`, and `scripts/` for SQL `INSERT`/`UPDATE`/`DELETE`, query-builder chains ending in `insert`/`upsert`/`update`/`delete`, and interpolated-table-name heuristics.
  - Real baseline: `scripts/gates/writer-baseline.json`.
  - Gate-fixture paths are excluded from production inventory; `scripts/` remains included.
- `gate:drift`: report-only skeleton. `scripts/onboarding/regenerate-all.mjs` is the aggregate-generation seam; until `onboarding:generate` exists, `scripts/gates/check-generated-drift.mjs` reports that condition and missing registered outputs but exits successfully.
  - CI wiring and required-flip notes: `docs/phaseb-ci-gates.md`.
- `gate:release-manifest`: `scripts/gates/assert-release-manifest.mjs` compares an artifact's baked `contractSeq` and `hash` with its manifest-relative entry. It never reads a moving repository revision.
- Gate self-tests: `npm run test:gates`, with clean and violation fixtures for every gate.

## Baseline Writer Counts

| Table | Statements |
| --- | ---: |
| `chat_messages` | 8 |
| `chat_sessions` | 7 |
| `session_log` | 16 |
| `beat_contexts` | 0 |
| `screen_contexts` | 3 |

## Validation Outputs

- `npm run test:gates`: **PASS** — 8/8 tests.
- `npm run gate:writers`: **PASS**.
- `npm run gate:release-manifest -- --artifact scripts/gates/__fixtures__/release-manifest/clean-artifact.json --manifest scripts/gates/__fixtures__/release-manifest/manifest.json`: **PASS**.
- Release-manifest mismatch fixture: **FAILS as expected** on `hash` mismatch.
- `npm run gate:drift`: **REPORTS only**: aggregate generator unavailable (`onboarding:generate` not registered) and missing `packages/shared/src/onboarding/beatIds.generated.ts`; exit status is zero by design.
- `npm run gate:ids`: **FAILS as intended** on the canonical app tree: **385** remaining hardcoded onboarding ID literals. This is the Phase B migration signal, not an allowlisted test exception.
- `npx tsc --noEmit`: **blocked by pre-existing generated-module absence**: `packages/shared/src/index.ts` imports `./onboarding/beatIds.js`, but `packages/shared/src/onboarding/beatIds.ts` is missing. The same issue made `npm ci` postinstall fail.

## CI Wiring

Add the required-now commands from `docs/phaseb-ci-gates.md` after dependency installation: `npm run gate:ids`, `npm run gate:writers`, and `npm run test:gates`. Keep `npm run gate:drift` visible but non-required until aggregate generation is implemented and the report-mode diff has demonstrated clean deploys.
