# Guided Growth MVP — docs index

Engineering docs for the Guided Growth app. Contracts and conventions live here so new code does
not drift.

## Contracts and conventions

- [anon_id contract](./anon-id-contract.md) — the single identity key for all behavioral data
  (#89). Read before adding any behavioral table or analytics call.
- [PostHog tracking plan](./posthog-tracking-plan.md) — event taxonomy.
- [Environments](./ENVIRONMENTS.md) — dev / staging / main pipeline.
- [Release](./RELEASE.md) — release + TestFlight notes process.
- [Hooks](./hooks.md)
- [Legacy tools audit](./legacy-tools-audit.md)

## State machines

- [Async reflection (Path 2)](./state-machines/async-reflection.md) — state machine + data
  contract for the check-in / async-reflection backend (#116 / #132).

## Folders

- `runbooks/` — operational runbooks.
- `state-machines/` — feature state-machine specs.
- `superpowers/` — internal tooling docs.
