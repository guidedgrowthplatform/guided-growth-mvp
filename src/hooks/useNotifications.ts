import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/notifications';
import { useAuth } from '@/hooks/useAuth';
import { fromRecord, type AppNotification } from '@/lib/notifications';
import {
  getLocalFeed,
  isLocalFeedId,
  markAllLocalRead,
  markLocalRead,
} from '@/lib/notifications/localFeed';
import { queryKeys } from '@/lib/query';

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery<AppNotification[]>({
    queryKey: queryKeys.notifications.all,
    queryFn: async () => {
      const [{ notifications }, local] = await Promise.all([fetchNotifications(), getLocalFeed()]);
      return [...notifications, ...local]
        .map(fromRecord)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const setRead = useCallback(
    (predicate: (n: AppNotification) => boolean) => {
      qc.setQueryData<AppNotification[]>(queryKeys.notifications.all, (prev) =>
        prev?.map((n) => (predicate(n) ? { ...n, unread: false } : n)),
      );
    },
    [qc],
  );

  // optimistic; durable copy is the local store for local ids, server otherwise
  const markRead = useCallback(
    (id: string) => {
      setRead((n) => n.id === id);
      const durable = isLocalFeedId(id)
        ? markLocalRead(id, new Date().toISOString())
        : markNotificationRead(id);
      Promise.resolve(durable).catch(() => {
        void qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
      });
    },
    [qc, setRead],
  );

  const markAllRead = useCallback(() => {
    setRead(() => true);
    void Promise.allSettled([
      markAllLocalRead(new Date().toISOString()),
      markAllNotificationsRead(),
    ]).then((results) => {
      if (results.some((r) => r.status === 'rejected')) {
        void qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
      }
    });
  }, [qc, setRead]);

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => n.unread).length;

  return { notifications, unreadCount, isLoading: query.isLoading, markRead, markAllRead };
}
