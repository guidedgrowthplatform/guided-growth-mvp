import { Icon } from '@iconify/react';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ReminderSheet } from '@/components/home';
import { useNotifications } from '@/hooks/useNotifications';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { formatTimeAgo } from '@/lib/notifications';

export function NotificationDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { preferences, updatePreferences } = useUserPreferences();
  const { notifications, markRead } = useNotifications();
  const [showReminders, setShowReminders] = useState(false);

  const notification = notifications.find((n) => n.id === id);
  if (!notification) return <Navigate to="/notifications" replace />;

  const { icon, iconClass, image, title, body, createdAt, unread } = notification;
  const detail = notification.detail ?? {
    eyebrow: notification.category === 'habit' ? 'Habit' : 'Journal',
    heading: title,
    paragraphs: [body],
  };

  return (
    <div className="-mt-2 flex flex-col pb-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface shadow-card"
        >
          <Icon icon="ic:round-arrow-back" width={16} className="text-content" />
        </button>
        <h1 className="flex-1 text-lg font-bold text-content">Detail</h1>
        <button
          type="button"
          aria-label="Notification settings"
          onClick={() => setShowReminders(true)}
          className="flex h-10 w-10 items-center justify-center"
        >
          <Icon icon="ic:round-settings" width={20} className="text-content" />
        </button>
      </div>

      <div className="mx-auto mt-8 flex h-36 w-36 items-center justify-center rounded-[32px] bg-surface shadow-card">
        {image ? (
          <img src={image} alt="" className="h-[72px] w-[72px] object-contain" />
        ) : (
          <Icon icon={icon} width={68} height={68} className={iconClass} />
        )}
      </div>

      <div className="px-2">
        <p className="mt-10 text-xs font-bold uppercase tracking-[0.2em] text-primary">
          {detail.eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-bold text-content">{detail.heading}</h2>
        <p className="mt-2 text-sm text-content-muted">{formatTimeAgo(createdAt)}</p>

        <div className="mt-6 flex flex-col gap-4">
          {detail.paragraphs.map((paragraph, i) => (
            <p
              key={i}
              className={`leading-relaxed ${
                i === 0 ? 'text-base text-content' : 'text-sm text-content-secondary'
              }`}
            >
              {paragraph}
            </p>
          ))}
        </div>

        {detail.insight && (
          <div className="mt-8 rounded-2xl bg-[#eef1fb] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
              {detail.insight.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-content-secondary">
              {detail.insight.body}
            </p>
          </div>
        )}

        <div className="mt-10 flex items-center gap-3" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-1.5 flex-1 rounded-full bg-primary" />
          ))}
        </div>

        {detail.action && (
          <button
            type="button"
            onClick={() => navigate(detail.action!.to)}
            className="mt-8 w-full rounded-full bg-primary py-4 text-base font-semibold text-white shadow-sm"
          >
            {detail.action.label}
          </button>
        )}

        {unread && (
          <button
            type="button"
            onClick={() => markRead(notification.id)}
            className="mt-5 w-full text-center text-xs font-semibold uppercase tracking-[0.2em] text-content-secondary"
          >
            Mark as read
          </button>
        )}
      </div>

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
