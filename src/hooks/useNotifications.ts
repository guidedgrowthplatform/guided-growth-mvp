import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/notifications';
import { useAuth } from '@/hooks/useAuth';
import { fromRecord, type AppNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query';

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery<AppNotification[]>({
    queryKey: queryKeys.notifications.all,
    queryFn: async () => {
      const { notifications } = await fetchNotifications();
      return notifications.map(fromRecord);
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

  // optimistic; server read_at is the durable copy
  const markRead = useCallback(
    (id: string) => {
      setRead((n) => n.id === id);
      markNotificationRead(id).catch(() => {
        void qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
      });
    },
    [qc, setRead],
  );

  const markAllRead = useCallback(() => {
    setRead(() => true);
    markAllNotificationsRead().catch(() => {
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    });
  }, [qc, setRead]);

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => n.unread).length;

  return { notifications, unreadCount, isLoading: query.isLoading, markRead, markAllRead };
}
