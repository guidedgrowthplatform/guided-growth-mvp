import { Icon } from '@iconify/react';
import { formatTimeAgo } from '@/lib/notifications';
import type { AppNotification } from '@/lib/notifications';

interface NotificationCardProps {
  notification: AppNotification;
  onPress: () => void;
  onCtaPress?: (to: string) => void;
}

export function NotificationCard({ notification, onPress, onCtaPress }: NotificationCardProps) {
  const { icon, iconClass, iconBg, image, title, body, createdAt, unread, cta } = notification;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPress();
        }
      }}
      className="flex w-full cursor-pointer items-center gap-4 rounded-2xl bg-surface p-5 text-left shadow-sm"
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full ${iconBg}`}
      >
        {image ? (
          <img src={image} alt="" className="h-7 w-7 object-contain" />
        ) : (
          <Icon icon={icon} width={24} height={24} className={iconClass} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-base font-bold text-content">{title}</span>
          <span className="shrink-0 text-sm text-content-muted">{formatTimeAgo(createdAt)}</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-content-secondary">{body}</p>
        {cta && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCtaPress?.(cta.to);
            }}
            className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            {cta.label}
          </button>
        )}
      </div>
      {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
    </div>
  );
}
