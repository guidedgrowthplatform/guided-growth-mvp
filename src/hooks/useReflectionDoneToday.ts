import { useQuery } from '@tanstack/react-query';
import { fetchJournalEntries } from '@/api/journal';
import { queryKeys } from '@/lib/query';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/utils/dates';

// Path-independent "evening done" signal: a reflection/journal entry persisted
// for today. The evening check-in's completion artifact is the reflection (via
// log_reflection → createJournalEntry), so reading the DATA — not only the
// fragile checkin_completed session-log event — is what keeps the evening from
// re-asking after it's finished. Mirrors useCheckIn for the morning bucket.
export function useReflectionDoneToday(enabled: boolean): boolean {
  const anonId = useAuthStore((s) => s.anonId);
  const today = formatDate(new Date());
  const { data } = useQuery({
    queryKey: queryKeys.journal.range(today, today),
    queryFn: () => fetchJournalEntries(today, today),
    enabled: enabled && !!anonId,
  });
  return (data?.length ?? 0) > 0;
}
