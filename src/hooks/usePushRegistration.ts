import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addLocalReminderListeners,
  currentFirstName,
  isLocalNotificationsGranted,
  isLocalRemindersSupported,
  remindersDueAt,
  rescheduleFromSnapshot,
} from '@/lib/localReminders';
import { ensureLocalFeedEntry } from '@/lib/notifications/localFeed';
import { loadLocalPreferences } from '@/lib/preferences/snapshot';
import {
  addPushListeners,
  ensureNotificationChannel,
  flushPendingToken,
  registerIfGranted,
} from '@/lib/push';
import { queryKeys } from '@/lib/query';
import { useAuthStore } from '@/stores/authStore';

export function usePushRegistration(): void {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const anonId = useAuthStore((s) => s.anonId);

  const invalidateFeed = useCallback(
    () => void qc.invalidateQueries({ queryKey: queryKeys.notifications.all, refetchType: 'all' }),
    [qc],
  );

  useEffect(
    () => addPushListeners((route) => navigate(route), invalidateFeed),
    [navigate, invalidateFeed],
  );

  useEffect(() => {
    void ensureNotificationChannel();
  }, []);

  useEffect(
    () =>
      addLocalReminderListeners(
        (route) => navigate(route),
        (type) =>
          void ensureLocalFeedEntry(type, currentFirstName(), new Date().toISOString()).then(
            invalidateFeed,
          ),
      ),
    [navigate, invalidateFeed],
  );

  useEffect(() => {
    if (!anonId) return;
    void flushPendingToken();
    void registerIfGranted();
    void rescheduleFromSnapshot();
  }, [anonId]);

  // recover same-session grants (settings round-trip) + reboot; backfill the feed
  // for reminders that fired while backgrounded and were never tapped
  useEffect(() => {
    if (!isLocalRemindersSupported()) return;
    const sync = async () => {
      if (document.visibilityState !== 'visible') return;
      await rescheduleFromSnapshot();
      if (!(await isLocalNotificationsGranted())) return;
      const now = new Date();
      const due = remindersDueAt(loadLocalPreferences(), now);
      const wrote = await Promise.all(
        due.map((type) => ensureLocalFeedEntry(type, currentFirstName(), now.toISOString())),
      );
      if (wrote.some(Boolean)) invalidateFeed();
    };
    const onVisible = () => void sync();
    void sync();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [invalidateFeed]);
}
