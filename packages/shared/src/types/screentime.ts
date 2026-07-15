// Uniform coach data contract for Screen Time — the BehaviorEpisode state model.
// Governing spec: gg-spec docs/screentime-coach-data-system-and-windows-2026-07-15.md
// (local summary: docs/screentime/coach-data-contract.md).
// The coach receives boundary STATE, never measured minutes — iOS can't supply
// numbers, Android reduces its numbers to the same bands. No app/package names.

// Emission rules (asymmetric by platform — the iOS ceiling):
//   crossed / approaching — positively observed (a threshold fired / usage measured)
//   on_track — ONLY Android real-usage observation or explicit user confirmation;
//              iOS must NEVER emit it from callback silence
//   kept     — ONLY a validated end-of-window signal or GG-owned completion
//   unknown  — no reliable signal; the iOS DEFAULT absent a positive event
export type BoundaryBand = 'on_track' | 'approaching' | 'crossed' | 'kept' | 'unknown';

export type BoundaryEvidenceSource =
  | 'threshold_event' // iOS DeviceActivityMonitor — PROVE-ON-DEVICE gated, not v1 coach input
  | 'android_usage'
  | 'gg_owned'
  | 'user_report';

export type BoundaryKind = 'app' | 'category' | 'selection';

export type BoundaryWindow = 'daily';

export interface ScreenTimeBoundary {
  id: string; // opaque native budget id (UUID — never derived from a package name)
  kind: BoundaryKind;
  limitMinutes: number; // configured by the user (GG-owned input), not measured usage
  window: BoundaryWindow;
  label?: string; // the user's own framing ("my doom apps") — GG-owned
  reason?: string; // why they set it ("present after dinner")
}

export interface ScreenTimeBoundaryState {
  boundaryId: string;
  band: BoundaryBand;
  evidenceSource?: BoundaryEvidenceSource; // absent when band is 'unknown'
  date: string; // YYYY-MM-DD of the window the band applies to
}

export interface ScreenTimeBandTransition {
  boundaryId: string;
  band: BoundaryBand;
  previousBand: BoundaryBand;
  evidenceSource: BoundaryEvidenceSource;
  date: string;
  at: number; // epoch seconds the native side observed the transition
}

export type ScreenTimeOverrideChoice = 'close' | 'five_minutes' | 'change_plan';

export type ScreenTimeBlockTrigger = 'usage_budget' | 'break' | 'pause';

// approaching fires at this fraction of the configured limit (tunable; not the
// window strategy — that lives in the gg-spec doc)
export const BOUNDARY_WARN_FRACTION = 0.8;
