// Uniform coach data contract for Screen Time (docs/screentime/coach-data-contract.md).
// The coach receives boundary STATE, never measured minutes — iOS can't supply numbers,
// Android reduces its numbers to the same bands. No app/package names in any of these.

export type BoundaryBand = 'kept' | 'approaching' | 'crossed';

export type BoundaryKind = 'app' | 'category' | 'selection';

export type BoundaryWindow = 'daily';

export interface ScreenTimeBoundary {
  id: string; // opaque native budget id
  kind: BoundaryKind;
  limitMinutes: number; // configured by the user (GG-owned input), not measured usage
  window: BoundaryWindow;
  label?: string; // the user's own framing ("my doom apps") — GG-owned
  reason?: string; // why they set it ("present after dinner")
}

export interface ScreenTimeBoundaryState {
  boundaryId: string;
  band: BoundaryBand;
  date: string; // YYYY-MM-DD of the window the band applies to
}

export interface ScreenTimeBandTransition {
  boundaryId: string;
  band: BoundaryBand;
  previousBand: BoundaryBand;
  date: string;
  at: number; // epoch seconds the native side observed the transition
}

export type ScreenTimeOverrideChoice = 'close' | 'five_minutes' | 'change_plan';

export type ScreenTimeBlockTrigger = 'usage_budget' | 'break' | 'pause';

// approaching fires at this fraction of the configured limit (tunable; not the
// [v2 pending] window strategy)
export const BOUNDARY_WARN_FRACTION = 0.8;
