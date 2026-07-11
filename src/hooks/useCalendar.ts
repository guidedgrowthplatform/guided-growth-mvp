import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import {
  disconnectCalendar,
  getCalendarStatus,
  isReauthError,
  setCalendarEnabled,
  setCalendarTarget,
  syncCalendar,
  type CalendarStatus,
} from '@/api/calendar';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query';
import { useAuthStore } from '@/stores/authStore';

const DEFAULT_STATUS: CalendarStatus = {
  connected: false,
  target: 'gg',
  enabled: false,
  needsReauth: false,
};

export function useCalendar() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();

  const query = useQuery<CalendarStatus>({
    queryKey: queryKeys.calendar.all,
    queryFn: getCalendarStatus,
    enabled: !!user,
    staleTime: 60_000,
  });

  const patch = useCallback(
    (partial: Partial<CalendarStatus>) => {
      qc.setQueryData<CalendarStatus>(queryKeys.calendar.all, (prev) => ({
        ...(prev ?? DEFAULT_STATUS),
        ...partial,
      }));
    },
    [qc],
  );

  // Redirects to Google consent; the ?intent=calendar callback POSTs the token and
  // returns to Settings, where this query refetches. No optimistic update here.
  const connect = useCallback(async () => {
    const { error } = await useAuthStore.getState().connectGoogleCalendar();
    if (error) addToast('error', error);
  }, [addToast]);

  const invalidate = () => void qc.invalidateQueries({ queryKey: queryKeys.calendar.all });

  // A background sync failing on a dead token flips the banner immediately.
  const backgroundSync = () =>
    void syncCalendar().catch((err) => {
      if (isReauthError(err)) patch({ needsReauth: true });
    });

  const disconnectMutation = useMutation({
    mutationFn: disconnectCalendar,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: queryKeys.calendar.all });
      const previous = qc.getQueryData<CalendarStatus>(queryKeys.calendar.all);
      patch({ connected: false, enabled: false });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.calendar.all, ctx.previous);
      addToast('error', 'Could not disconnect. Please try again.');
    },
    onSuccess: invalidate,
  });

  const targetMutation = useMutation({
    mutationFn: setCalendarTarget,
    onMutate: async (target: CalendarStatus['target']) => {
      await qc.cancelQueries({ queryKey: queryKeys.calendar.all });
      const previous = qc.getQueryData<CalendarStatus>(queryKeys.calendar.all);
      patch({ target });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.calendar.all, ctx.previous);
      addToast('error', 'Could not update. Please try again.');
    },
    // Switching target moves events to the other calendar — re-materialize.
    onSuccess: () => {
      invalidate();
      backgroundSync();
    },
  });

  const enabledMutation = useMutation({
    mutationFn: setCalendarEnabled,
    onMutate: async (enabled: boolean) => {
      await qc.cancelQueries({ queryKey: queryKeys.calendar.all });
      const previous = qc.getQueryData<CalendarStatus>(queryKeys.calendar.all);
      patch({ enabled });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.calendar.all, ctx.previous);
      addToast('error', 'Could not update. Please try again.');
    },
    // Re-enable re-materializes events; disable is a pause (events left in place).
    onSuccess: (_data, enabled: boolean) => {
      invalidate();
      if (enabled) backgroundSync();
    },
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const syncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await syncCalendar();
      if (res.skipped) addToast('info', 'Sync already in progress');
      else addToast('success', `Synced — ${res.written ?? 0} events`);
    } catch (err) {
      if (isReauthError(err)) {
        patch({ needsReauth: true });
        addToast('error', 'Reconnect your calendar to sync');
      } else {
        addToast('error', 'Could not sync. Please try again.');
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, addToast, patch]);

  const status = query.data ?? DEFAULT_STATUS;

  return {
    connected: status.connected,
    target: status.target,
    enabled: status.enabled,
    needsReauth: status.needsReauth,
    isLoading: query.isLoading,
    isSyncing,
    connect,
    disconnect: () => disconnectMutation.mutate(),
    setTarget: (t: CalendarStatus['target']) => targetMutation.mutate(t),
    setEnabled: (e: boolean) => enabledMutation.mutate(e),
    syncNow,
  };
}
