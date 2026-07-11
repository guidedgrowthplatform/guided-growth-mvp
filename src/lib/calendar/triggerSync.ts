import { syncCalendar } from '@/api/calendar';

// Fire-and-forget calendar re-sync after a schedule-affecting change.
// Fires unconditionally: the server 409s (not_connected / disabled) are cheap and
// swallowed. Gating on the cached calendar status silently dropped syncs whenever
// that query wasn't warm (e.g. the Home reminder sheet, or a fresh app launch).
export function triggerCalendarSync(): void {
  void syncCalendar().catch(() => {});
}
