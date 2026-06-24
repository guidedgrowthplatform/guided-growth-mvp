import { REMINDER_VARIANTS } from '../generated/notification_copy.js';
import type { PushNotificationCategory, PushNotificationType } from '../types/index.js';

export { REMINDER_VARIANTS };

// must stay in sync across push.ts, localReminders.ts + the Android manifest default channel
export const ANDROID_REMINDER_CHANNEL_ID = 'reminders';

// inactivity window for the session-expired push; keep == Supabase inactivity timeout
export const SESSION_EXPIRED_WINDOW_DAYS = 14;
export const SESSION_EXPIRED_WINDOW_MS = SESSION_EXPIRED_WINDOW_DAYS * 24 * 60 * 60 * 1000;

// the two locally-scheduled reminders; session_expired is push-only and excluded
export type LocalReminderType = 'morning_checkin' | 'evening_checkin';

// base id per slot; +dayOffset per window day. ranges must not overlap (1001..1007 / 1011..1017)
export const REMINDER_IDS: Record<LocalReminderType, number> = {
  morning_checkin: 1001,
  evening_checkin: 1011,
};

export const REMINDER_WINDOW_DAYS = 7;

// action buttons on reminder notifications (Continue / Delete)
export const REMINDER_ACTION_TYPE_ID = 'reminder_actions';
export const REMINDER_ACTION_CONTINUE = 'continue';
export const REMINDER_ACTION_DELETE = 'delete';
export const REMINDER_ACTION_TAP = 'tap';

export interface NotificationContent {
  category: PushNotificationCategory;
  title: string;
  body: string;
  data: Record<string, string>;
}

const REMINDER_META: Record<
  LocalReminderType,
  { category: PushNotificationCategory; route: string }
> = {
  morning_checkin: { category: 'journal', route: '/home?checkin=morning' },
  evening_checkin: { category: 'journal', route: '/home?checkin=evening' },
};

// date components (not elapsed ms) → DST-immune
export function reminderVariantIndex(date: Date): number {
  const dayOrdinal = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
  return ((dayOrdinal % 7) + 7) % 7;
}

export function buildNotificationContent(
  type: PushNotificationType,
  firstName: string | null,
  variantIndex?: number,
): NotificationContent {
  if (type === 'session_expired') {
    return {
      category: 'account',
      title: 'Your session expired',
      body: 'Sign back in to pick up where you left off.',
      data: { route: '/login', type },
    };
  }

  const variants = REMINDER_VARIANTS[type];
  const idx = (((variantIndex ?? 0) % variants.length) + variants.length) % variants.length;
  const variant = variants[idx];
  const meta = REMINDER_META[type];
  return {
    category: meta.category,
    title: variant.title,
    body: variant.body,
    data: { route: meta.route, type },
  };
}

export function parseHHMM(value: string | null): { hour: number; minute: number } | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}
