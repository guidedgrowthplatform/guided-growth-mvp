import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { ReminderSheet } from '@/components/home';
import { SegmentedControl } from '@/components/insights/SegmentedControl';
import {
  EmptyNotifications,
  NotificationCard,
  NotificationSkeleton,
  WeeklySummaryCard,
} from '@/components/notifications';
import { useNotifications } from '@/hooks/useNotifications';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import type { NotificationCategory } from '@/lib/notifications';

const TAB_ITEMS = [
  { label: 'Habit', value: 'habit' },
  { label: 'Journal', value: 'journal' },
];

export function NotificationsPage() {
  const navigate = useNavigate();
  const { preferences, updatePreferences } = useUserPreferences();
  const { notifications, isLoading, markRead, markAllRead } = useNotifications();
  const [activeTab, setActiveTab] = useState<NotificationCategory>('habit');
  const [showReminders, setShowReminders] = useState(false);

  useEffect(() => {
    track('view_notifications');
  }, []);

  const visible = notifications.filter((n) => n.category === activeTab);

  return (
    <div className="-mt-2 flex flex-col gap-5 pb-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface shadow-card"
        >
          <Icon icon="ic:round-arrow-back" width={16} className="text-content" />
        </button>
        <h1 className="flex-1 text-lg font-bold text-content">Notifications</h1>
        <button
          type="button"
          aria-label="Mark all as read"
          onClick={() => {
            track('mark_all_notifications_read');
            markAllRead();
          }}
          className="flex h-10 w-10 items-center justify-center"
        >
          <Icon icon="mdi:check-all" width={20} className="text-content" />
        </button>
        <button
          type="button"
          aria-label="Notification settings"
          onClick={() => setShowReminders(true)}
          className="flex h-10 w-10 items-center justify-center"
        >
          <Icon icon="ic:round-settings" width={20} className="text-content" />
        </button>
      </div>

      <SegmentedControl
        items={TAB_ITEMS}
        value={activeTab}
        onChange={(value) => setActiveTab(value as NotificationCategory)}
        size="lg"
      />

      <div className="flex flex-col gap-3">
        {isLoading && visible.length === 0 ? (
          <NotificationSkeleton />
        ) : visible.length === 0 ? (
          <EmptyNotifications category={activeTab} />
        ) : (
          visible.map((n) => (
            <NotificationCard
              key={n.id}
              notification={n}
              onPress={() => {
                track('tap_notification', { id: n.id });
                navigate(`/notifications/${n.id}`);
              }}
              onCtaPress={(to) => {
                markRead(n.id);
                navigate(to);
              }}
            />
          ))
        )}
      </div>

      {activeTab === 'habit' && <WeeklySummaryCard onViewReport={() => navigate('/report')} />}

      {showReminders && (
        <ReminderSheet
          onClose={() => setShowReminders(false)}
          initialMorningTime={preferences.morningTime}
          initialNightTime={preferences.nightTime}
          initialPushNotifications={preferences.pushNotifications}
          onSave={(data) => updatePreferences(data)}
        />
      )}
    </div>
  );
}
