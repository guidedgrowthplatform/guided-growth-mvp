# Contexts Builder Report

- Added `scripts/onboarding/generate.ts`, the contract-driven runtime context projector.
- Input fixture: `src/onboarding-flow/flows/onboarding-contract.v1.json` until the Phase A exporter lands.
- Outputs: backend and frontend context JSON artifacts plus contract revision/SHA-256 metadata sidecars.
- `allowedTools` now originates in the contract and is emitted in `beat_contexts.json` and surfaced in `onboarding_combined.json`; `beatContexts.ts` remains unchanged.
- Added byte-stability, consumer-shape, and inheritance/no-mutation tests.
- Decision: retire Supabase `beat_contexts` after the Phase C/E rollback and supported-consumer gates; see `docs/decisions/beat-contexts-supabase-decision.md`.
