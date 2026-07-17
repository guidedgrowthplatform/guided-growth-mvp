# Phase B CI Gates

## Required now

Run these after `npm ci --ignore-scripts` and before the existing TypeScript/test jobs:

```bash
npm run gate:ids
npm run gate:writers
npm run test:gates
```

`gate:ids` scans only runtime `api/` and `src/`. It rejects exact canonical or legacy contract IDs. The generated crosswalk module, `supabase/migrations/`, audit artifacts, and the analytics remap note are allowed; tests are intentionally not allowed.

`gate:writers` scans `api/`, `src/`, and `scripts/` for SQL writes, Supabase query-builder writes, and interpolated table-name heuristics. It compares exact inventoried statement locations against `scripts/gates/writer-baseline.json`; an increase or any new location fails.

## Drift report mode

```bash
npm run gate:drift
```

This check is intentionally report-only until the aggregate `onboarding:generate` command lands. It reports missing configured generated artifacts and must not be a branch-protection requirement yet. Once aggregate generation is available, wire it to regenerate into a temporary worktree/copy, compare the configured artifacts byte-for-byte, and keep the check visibly failing in report mode rather than using `continue-on-error`.

## Deploy assertion

The deploy job supplies paths from the release package, not repository `HEAD`:

```bash
npm run gate:release-manifest -- --artifact release/artifact.json --manifest release/release-manifest.json
```

The artifact must bake `contractSeq` and `hash` (optionally under `generatedFrom`). The manifest entry is looked up by artifact `name`, then `path`; both fields must match exactly.
