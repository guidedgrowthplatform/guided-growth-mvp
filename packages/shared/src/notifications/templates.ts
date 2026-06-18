import type { PushNotificationCategory, PushNotificationType } from '../types/index.js';

// must stay in sync across push.ts, localReminders.ts + the Android manifest default channel
export const ANDROID_REMINDER_CHANNEL_ID = 'reminders';

// integer ids required by @capacitor/local-notifications; fixed → reschedule = cancel+re-add
export const REMINDER_IDS: Record<PushNotificationType, number> = {
  morning_checkin: 1001,
  evening_checkin: 1002,
};

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
  const title = `Hi ${firstName ?? 'there'}!`;
  switch (type) {
    case 'morning_checkin':
      return {
        category: 'habit',
        title,
        body: "Two minutes of morning check-in. Let's set up your day.",
        data: { route: '/home', type },
      };
    case 'evening_checkin':
      return {
        category: 'journal',
        title,
        body: "Five minutes of evening reflection. Let's close the day clean.",
        data: { route: '/journal', type },
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
