import { useCallback, useMemo, useState } from 'react';
import { MOCK_NOTIFICATIONS } from '@/lib/notifications';
import type { AppNotification } from '@/lib/notifications';

const READ_KEY = 'gg_notifications_read';

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function persistReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
  } catch {
    // quota / private mode
  }
}

// Mock-backed until the notifications backend lands; swap MOCK_NOTIFICATIONS
// for an API client here, keeping the same surface.
export function useNotifications() {
  const [readIds, setReadIds] = useState<Set<string>>(loadReadIds);

  const notifications: AppNotification[] = useMemo(
    () => MOCK_NOTIFICATIONS.map((n) => ({ ...n, unread: n.unread && !readIds.has(n.id) })),
    [readIds],
  );

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      persistReadIds(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds(() => {
      const next = new Set(MOCK_NOTIFICATIONS.map((n) => n.id));
      persistReadIds(next);
      return next;
    });
  }, []);

  return { notifications, markRead, markAllRead };
}
