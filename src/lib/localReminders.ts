import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { loadLocalPreferences, type UserPreferences } from '@/lib/preferences/snapshot';
import { useAuthStore } from '@/stores/authStore';
import {
  ANDROID_REMINDER_CHANNEL_ID,
  buildNotificationContent,
  parseHHMM,
  REMINDER_IDS,
  type PushNotificationType,
} from '@gg/shared';

export interface ReminderPrefs {
  morningTime: string;
  nightTime: string;
  pushNotifications: boolean;
  firstName: string | null;
}

type ReminderTimes = Pick<UserPreferences, 'morningTime' | 'nightTime' | 'pushNotifications'>;
type TimeKey = 'morningTime' | 'nightTime';

const SLOTS: ReadonlyArray<[PushNotificationType, TimeKey]> = [
  ['morning_checkin', 'morningTime'],
  ['evening_checkin', 'nightTime'],
];

export function isLocalRemindersSupported(): boolean {
  return Capacitor.isNativePlatform();
}

export function currentFirstName(): string | null {
  const u = useAuthStore.getState().user;
  return u?.nickname ?? u?.name?.trim().split(/\s+/)[0] ?? null;
}

export type LocalPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export async function checkLocalNotificationPermission(): Promise<LocalPermissionState> {
  if (!isLocalRemindersSupported()) return 'unsupported';
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display === 'granted') return 'granted';
    if (display === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'denied';
  }
}

export async function isLocalNotificationsGranted(): Promise<boolean> {
  return (await checkLocalNotificationPermission()) === 'granted';
}

export async function requestLocalNotificationPermission(): Promise<boolean> {
  if (!isLocalRemindersSupported()) return false;
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  } catch (err) {
    console.warn('[localReminders] permission request failed', err);
    return false;
  }
}

// Android 12+ exact alarms: best-effort. Declining degrades to inexact (Doze ~9min).
export async function ensureExactAlarmPermission(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting();
    if (exact_alarm !== 'granted') await LocalNotifications.changeExactNotificationSetting();
  } catch (err) {
    console.warn('[localReminders] exact-alarm setting failed', err);
  }
}

export async function openSystemNotificationSettings(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await LocalNotifications.changeExactNotificationSetting();
  } catch (err) {
    console.warn('[localReminders] open settings failed', err);
  }
}

// own the channel via LocalNotifications so reminders work without FCM/google-services.json;
// Android 8+ silently drops notifications posted to a missing channel
async function ensureReminderChannel(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await LocalNotifications.createChannel({
      id: ANDROID_REMINDER_CHANNEL_ID,
      name: 'Reminders',
      description: 'Daily check-in and reflection reminders',
      importance: 4,
      visibility: 0,
    });
  } catch (err) {
    console.warn('[localReminders] channel creation failed', err);
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (!isLocalRemindersSupported()) return;
  try {
    await LocalNotifications.cancel({
      notifications: Object.values(REMINDER_IDS).map((id) => ({ id })),
    });
  } catch (err) {
    console.warn('[localReminders] cancel failed', err);
  }
}

export async function rescheduleReminders(prefs: ReminderPrefs): Promise<void> {
  if (!isLocalRemindersSupported()) return;
  if (!(await isLocalNotificationsGranted())) return;

  await cancelAllReminders();
  if (!prefs.pushNotifications) return;

  const times: ReminderTimes = prefs;
  const notifications = [];
  for (const [type, key] of SLOTS) {
    const at = parseHHMM(times[key]);
    if (!at) continue;
    const content = buildNotificationContent(type, prefs.firstName);
    notifications.push({
      id: REMINDER_IDS[type],
      title: content.title,
      body: content.body,
      channelId: ANDROID_REMINDER_CHANNEL_ID,
      extra: content.data,
      schedule: { on: { hour: at.hour, minute: at.minute }, allowWhileIdle: true },
    });
  }

  if (notifications.length === 0) return;
  await ensureReminderChannel();
  try {
    await LocalNotifications.schedule({ notifications });
  } catch (err) {
    console.warn('[localReminders] schedule failed', err);
  }
}

function toReminderPrefs(p: ReminderTimes): ReminderPrefs {
  return {
    morningTime: p.morningTime,
    nightTime: p.nightTime,
    pushNotifications: p.pushNotifications,
    firstName: currentFirstName(),
  };
}

export function rescheduleFromPrefs(p: ReminderTimes): Promise<void> {
  return rescheduleReminders(toReminderPrefs(p));
}

export function rescheduleFromSnapshot(): Promise<void> {
  return rescheduleFromPrefs(loadLocalPreferences());
}

export function remindersDueAt(p: ReminderTimes, now: Date): PushNotificationType[] {
  if (!p.pushNotifications) return [];
  const mins = now.getHours() * 60 + now.getMinutes();
  const due: PushNotificationType[] = [];
  for (const [type, key] of SLOTS) {
    const at = parseHHMM(p[key]);
    if (at && mins >= at.hour * 60 + at.minute) due.push(type);
  }
  return due;
}

export function addLocalReminderListeners(
  onNavigate: (route: string) => void,
  onFire: (type: PushNotificationType) => void,
): () => void {
  if (!isLocalRemindersSupported()) return () => {};

  const received = LocalNotifications.addListener('localNotificationReceived', (n) => {
    const type = (n.extra as Record<string, string> | undefined)?.type;
    if (type) onFire(type as PushNotificationType);
  });

  const tapped = LocalNotifications.addListener(
    'localNotificationActionPerformed',
    ({ notification }) => {
      const extra = notification.extra as Record<string, string> | undefined;
      if (extra?.type) onFire(extra.type as PushNotificationType);
      onNavigate(extra?.route ?? '/notifications');
    },
  );

  return () => {
    void received.then((l) => l.remove());
    void tapped.then((l) => l.remove());
  };
}
