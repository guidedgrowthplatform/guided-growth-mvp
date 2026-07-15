# Screen Time — Uniform Coach Data Contract

Status: 2026-07-15, v1 — locked against the iOS ceiling per Yair's get-started brief
(gg-spec `docs/screentime-android-and-coach-getstarted-2026-07-15.md`). Android over-delivers
into this same shape; nothing here requires data iOS cannot honestly supply.

**[v2 pending] — NOT locked here:** the exact iOS window strategy (which hours get the 20
activity slots, stepped-threshold banding). This contract only fixes the _shape_ the coach
consumes; the iOS emitter behind it can change windows without touching the contract.

## The one rule

**The coach receives boundary STATE, never measured minutes.** iOS cannot feed the coach raw
usage numbers (report extension is sealed; tokens are opaque). So the shared baseline is an
ordinal band per boundary:

```
kept → approaching → crossed        (resets to kept at the day/window rollover)
```

Card copy maps 1:1: "on track" / "approaching" / "crossed". Do NOT put "47 of 60 min" on any
coach-fed surface. Android reads real minutes via UsageStats and _reduces_ them to these bands
before anything reaches the coach.

## What the coach may receive (shared inputs, honest on BOTH platforms)

1. **Picks + user framing** — the label + reason the user gave the set ("my doom apps",
   "present after dinner"). GG-owned strings the user typed; richer than any package id.
2. **Configured boundaries** — which limit, which window, the configured limit minutes.
   (Configured minutes are user input, GG-owned — allowed. _Measured_ minutes are not.)
3. **Boundary band per boundary** — kept / approaching / crossed, plus transition events.
4. **GG-owned block + override events** — shield hit, "five more minutes" chosen, break
   started/ended. Always available on both platforms (iOS block-hit needs the ShieldAction
   extension, M2b/M2c — until then iOS emits crossings, not taps).
5. **Goals, reflections, mood, check-ins** — already native to GG.

## What NEVER leaves the device

- App / package / category names tied to usage. (iOS: platform-enforced — tokens are opaque.
  Android: our choice, enforced by this contract — word it "we choose not to transmit," never
  "impossible".)
- Measured per-app or aggregate usage minutes, session times, pickups.
- Android enrichers (real minutes, trends, first-pickup, reopen loops) render **on-device
  only** in the local detail view. They may sharpen local card copy but are never promised,
  never in session_log payloads, never in `/api/llm` bodies.

Two-layer dashboard: the **coach card** (universal) is fed only by this contract; the
**detail view** ("see the full report") is Apple's sealed DeviceActivityReport on iOS and a
local UsageStats view on Android — full numbers for the user's eyes, on-device on both.

## Transport: session_log events

The coach already consumes session_log via the optimistic state-delta pipeline
(`recent_events` → `/api/llm`). Screen-time speaks the same language — new event types
(registered in `packages/shared/src/types/session-events.ts` + seeded by migration; both in
the same PR, staging DB must run the migration before events land):

| event_type                          | payload (allowed keys only)                                                                            | emitted when                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `screentime_boundary_set`           | `boundary_id, kind ('app'\|'category'\|'selection'), limit_minutes, window ('daily'), label?, reason?` | user creates/edits a limit                                            |
| `screentime_boundary_removed`       | `boundary_id`                                                                                          | user removes a limit                                                  |
| `screentime_boundary_state_changed` | `boundary_id, band, previous_band, label?, date (YYYY-MM-DD)`                                          | band transition observed (drained on app-open/foreground on iOS)      |
| `screentime_block_hit`              | `boundary_id?, trigger ('usage_budget'\|'break'\|'pause')`                                             | user hits the wall (Android interstitial; iOS after ShieldAction ext) |
| `screentime_override_chosen`        | `boundary_id?, choice ('close'\|'five_minutes'\|'change_plan')`                                        | choice made at the wall                                               |
| `screentime_break_started`          | `minutes?` (0/absent = manual until ended)                                                             | GG break armed                                                        |
| `screentime_break_ended`            | `reason ('expired'\|'ended_manually')`                                                                 | break lifted                                                          |

Payload law: **no app names, no package ids, no measured minutes** in any of these. `label` /
`reason` are the user's own typed strings (GG-owned). `boundary_id` is the opaque budget id.

## Types (single source: `packages/shared/src/types/screentime.ts`)

```ts
type BoundaryBand = 'kept' | 'approaching' | 'crossed';
interface ScreenTimeBoundary {
  id: string; // opaque native budget id
  kind: 'app' | 'category' | 'selection';
  limitMinutes: number; // configured (user input), not measured
  window: 'daily'; // windows beyond daily = [v2 pending]
  label?: string; // user's framing, GG-owned
  reason?: string;
}
interface ScreenTimeBoundaryState {
  boundaryId: string;
  band: BoundaryBand;
  date: string;
}
```

Plugin surface addition (both platforms): `getBoundaryStates() → { states: ScreenTimeBoundaryState[] }`
and a drain of pending band transitions for event emission. iOS backs it with monitor-extension
threshold events written to the App Group (the monitor CAN write; the report extension can't).
Android backs it by reducing UsageStats minutes against configured budgets.

## iOS band emission (mechanics, v1)

- Per budget, arm **two** threshold events: `<id>` at `limitMinutes` (existing — trips the
  shield) and `<id>.warn` at ~80% of `limitMinutes` (approaching). The 80% figure is a
  tunable constant, NOT the [v2 pending] window strategy — windows are about which hours get
  instrumented; this is within the existing per-budget daily schedule.
- Slot budget: each DeviceActivityEvent is per-schedule, both events live in the single
  `gg.daily` activity — this does not consume extra slots of the 20-activity cap.
- The monitor writes band transitions to the App Group journal (`gg.bands.v1` /
  `gg.bandlog.v1`); the app drains the journal on foreground and emits
  `screentime_boundary_state_changed` events.
- **Reliability gate (from the brief):** `eventDidReachThreshold` is documented-flaky across
  iOS versions. The threshold channel is _to be proven on a physical-device matrix_ before any
  server-side coaching depends on it. Until then the coach treats bands as best-effort signal;
  GG-owned events (picks, breaks, config) are the reliable base.

## Android band emission (mechanics, v1)

Read `UsageStatsManager` a few times a day + on app-open (not a live feed), sum foreground
minutes per configured boundary, reduce: `< warn% → kept`, `≥ warn% → approaching`,
`≥ 100% → crossed`. Same journal-drain → same events. Real minutes stop at the reducer.
