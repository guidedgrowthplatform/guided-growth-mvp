import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addPushListeners,
  ensureNotificationChannel,
  flushPendingToken,
  registerIfGranted,
} from '@/lib/push';
import { queryKeys } from '@/lib/query';
import { supabaseDataService } from '@/lib/services/supabase-data-service';
import { useAuthStore } from '@/stores/authStore';

// cron skips users with NULL timezone — without this sync nobody gets pushes
async function syncTimezone(): Promise<void> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!timezone) return;
  try {
    const prefs = await supabaseDataService.getPreferences();
    if (prefs?.timezone !== timezone) {
      await supabaseDataService.upsertPreferences({ timezone });
    }
  } catch (err) {
    console.warn('[push] timezone sync failed', err);
  }
}

export function usePushRegistration(): void {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const anonId = useAuthStore((s) => s.anonId);

  useEffect(
    () =>
      addPushListeners(
        (route) => navigate(route),
        () =>
          void qc.invalidateQueries({
            queryKey: queryKeys.notifications.all,
            refetchType: 'all',
          }),
      ),
    [navigate, qc],
  );

  useEffect(() => {
    void ensureNotificationChannel();
  }, []);

  useEffect(() => {
    if (!anonId) return;
    void flushPendingToken();
    void registerIfGranted();
    void syncTimezone();
  }, [anonId]);
}
