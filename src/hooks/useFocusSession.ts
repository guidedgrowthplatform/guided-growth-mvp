import { useCallback, useState } from 'react';
import type { FocusSession } from '@/lib/services/data-service.interface';
import { getDataService } from '@/lib/services/service-provider';

export interface UseFocusSessionReturn {
  isSaving: boolean;
  lastSession: FocusSession | null;
  error: string | null;
  saveFocusSession: (
    habitId: string | null,
    durationMinutes: number,
    actualMinutes: number | null,
    startedAt: string,
  ) => Promise<FocusSession | null>;
}

export function useFocusSession(): UseFocusSessionReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSession, setLastSession] = useState<FocusSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveFocusSession = useCallback(
    async (
      habitId: string | null,
      durationMinutes: number,
      actualMinutes: number | null,
      startedAt: string,
    ): Promise<FocusSession | null> => {
      try {
        setIsSaving(true);
        setError(null);

        const ds = await getDataService();
        const session = await ds.saveFocusSession(
          habitId,
          durationMinutes,
          actualMinutes,
          startedAt,
        );

        setLastSession(session);
        return session;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save focus session';
        setError(message);
        console.error('[useFocusSession] Save failed:', err);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  return { isSaving, lastSession, error, saveFocusSession };
}
