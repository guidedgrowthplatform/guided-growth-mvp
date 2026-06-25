/**
 * Stale-guard for the onboarding Realtime sync.
 *
 * Regression context: the PUT save handler's RETURNING clause originally omitted
 * `updated_at` / `created_at`, so the just-saved cache row carried
 * `updated_at === undefined`. With an undefined timestamp the guard can never
 * prove a late echo is older, so a delayed Realtime echo of the PRE-save row
 * clobbered fresh state in the post-save window. The fix adds those columns to
 * RETURNING; this test pins the guard's behavior for both row shapes.
 */
import { describe, expect, it } from 'vitest';
import { isStaleRealtimeRow } from '../useOnboardingRealtimeSync';

type Row = { updated_at?: string };

describe('isStaleRealtimeRow', () => {
  it('drops an echo that is strictly older than the current row', () => {
    const current: Row = { updated_at: '2026-06-25T10:00:01.000Z' };
    const olderEcho: Row = { updated_at: '2026-06-25T10:00:00.000Z' };
    expect(isStaleRealtimeRow(current, olderEcho)).toBe(true);
  });

  it('keeps a newer (or equal-time) incoming row', () => {
    const current: Row = { updated_at: '2026-06-25T10:00:00.000Z' };
    expect(isStaleRealtimeRow(current, { updated_at: '2026-06-25T10:00:02.000Z' })).toBe(false);
    // Equal timestamps are NOT stale (strict comparison), so never drop our own save echo.
    expect(isStaleRealtimeRow(current, { updated_at: '2026-06-25T10:00:00.000Z' })).toBe(false);
  });

  it('never drops when there is no current row to compare against', () => {
    expect(isStaleRealtimeRow(null, { updated_at: '2026-06-25T10:00:00.000Z' })).toBe(false);
    expect(isStaleRealtimeRow(undefined, { updated_at: '2026-06-25T10:00:00.000Z' })).toBe(false);
  });

  it('regression: a save response missing updated_at can never guard a late older echo', () => {
    // This is the exact pre-fix shape: the PUT response lacked updated_at, so the
    // freshly-saved cache row had no timestamp. An older echo arriving afterward
    // would NOT be classed stale, and would overwrite the fresh save.
    const freshSaveWithoutTimestamp: Row = {}; // updated_at undefined
    const olderEcho: Row = { updated_at: '2026-06-25T09:59:59.000Z' };
    expect(isStaleRealtimeRow(freshSaveWithoutTimestamp, olderEcho)).toBe(false);

    // With the fix, the save response carries updated_at, so the same older echo
    // is correctly dropped.
    const freshSaveWithTimestamp: Row = { updated_at: '2026-06-25T10:00:05.000Z' };
    expect(isStaleRealtimeRow(freshSaveWithTimestamp, olderEcho)).toBe(true);
  });
});
