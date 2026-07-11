import { isReauthError, syncCalendar, type CalendarStatus } from '@/api/calendar';
import { queryClient, queryKeys } from '@/lib/query';

// Fire-and-forget calendar re-sync after a schedule-affecting change. Fires
// unconditionally (a cheap 409 when not connected is swallowed); a dead token
// flips the reconnect banner. No-op on a cold cache.
export function triggerCalendarSync(): void {
  void syncCalendar().catch((err) => {
    if (!isReauthError(err)) return;
    queryClient.setQueryData<CalendarStatus>(queryKeys.calendar.all, (prev) =>
      prev ? { ...prev, needsReauth: true } : prev,
    );
  });
}
