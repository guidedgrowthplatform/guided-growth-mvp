import type { PushNotificationCategory, PushNotificationType } from '../types/index.js';

// must stay in sync across push.ts, localReminders.ts + the Android manifest default channel
export const ANDROID_REMINDER_CHANNEL_ID = 'reminders';

// inactivity window for the session-expired push; keep == Supabase inactivity timeout
export const SESSION_EXPIRED_WINDOW_DAYS = 14;
export const SESSION_EXPIRED_WINDOW_MS = SESSION_EXPIRED_WINDOW_DAYS * 24 * 60 * 60 * 1000;

// the two locally-scheduled reminders; session_expired is push-only and excluded
export type LocalReminderType = 'morning_checkin' | 'evening_checkin';

// integer ids required by @capacitor/local-notifications; fixed → reschedule = cancel+re-add
export const REMINDER_IDS: Record<LocalReminderType, number> = {
  morning_checkin: 1001,
  evening_checkin: 1002,
};

// action buttons on reminder notifications (Continue / Delete)
export const REMINDER_ACTION_TYPE_ID = 'reminder_actions';
export const REMINDER_ACTION_CONTINUE = 'continue';
export const REMINDER_ACTION_DELETE = 'delete';

export interface NotificationContent {
  category: PushNotificationCategory;
  title: string;
  body: string;
  data: Record<string, string>;
}

export function buildNotificationContent(
  type: PushNotificationType,
  firstName: string | null,
): NotificationContent {
  switch (type) {
    case 'morning_checkin':
      return {
        category: 'habit',
        title: `Hi ${firstName ?? 'there'}!`,
        body: "Two minutes of morning check-in. Let's set up your day.",
        data: { route: '/home', type },
      };
    case 'evening_checkin':
      return {
        category: 'journal',
        title: `Hi ${firstName ?? 'there'}!`,
        body: "Five minutes of evening reflection. Let's close the day clean.",
        data: { route: '/journal', type },
      };
    case 'session_expired':
      return {
        category: 'account',
        title: 'Your session expired',
        body: 'Sign back in to pick up where you left off.',
        data: { route: '/login', type },
      };
  }
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
