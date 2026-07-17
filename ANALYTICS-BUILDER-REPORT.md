# Analytics Senders Builder Report

## Scope completed

- Migrated the four verified `session_log` lane consumers to the local generated onboarding ID import surface:
  - `src/hooks/useNavigateLogger.ts`
  - `src/hooks/useOnboarding.ts`
  - `src/hooks/useRealtimeVoice.ts`
  - `src/hooks/useScreenMap.ts`
- Used `@gg/shared/onboarding/beatIds`, a thin local re-export surface over `beatIds.generated.ts`.
- Preserved current IDs as v1 compatibility values in `packages/shared/src/onboarding/beatIds.generated.ts`.
- Retained the durable remap documentation in `docs/migrations/onboarding-analytics-id-remap.generated.md`.

## Compatibility

- Navigation, form-submit `screen_id`, realtime voice `canonical_screen_id`, and screen-route resolution continue to emit the same values.
- Legacy onboarding IDs resolve to canonical IDs.
- Unknown values pass through where they previously did; explicit `feedback` drops remain drops.
- Event schema and historical PostHog data remain unchanged. The remap note documents the one-time dashboard and saved-query update; historical PostHog events are immutable.

## Validation

- Added/updated snapshot coverage in `src/hooks/__tests__/sessionLogSenderIds.test.ts` for payloads emitted by all four senders.
- Passed `npx tsc --noEmit` with Node `v22.23.1`.
- Passed `npx vitest run src/hooks/__tests__/sessionLogSenderIds.test.ts` (2 tests).
