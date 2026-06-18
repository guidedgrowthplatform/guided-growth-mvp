import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { loadLocalPreferences, type UserPreferences } from '@/lib/preferences/snapshot';
import { useAuthStore } from '@/stores/authStore';
import {
  ANDROID_REMINDER_CHANNEL_ID,
  buildNotificationContent,
  parseHHMM,
  REMINDER_IDS,
  type LocalReminderType,
} from '@gg/shared';

const ARMED_KEY = 'reminders_armed_at';

export interface ReminderPrefs {
  morningTime: string;
  nightTime: string;
  pushNotifications: boolean;
  firstName: string | null;
}

type ReminderTimes = Pick<UserPreferences, 'morningTime' | 'nightTime' | 'pushNotifications'>;
type TimeKey = 'morningTime' | 'nightTime';
const SLOTS: ReadonlyArray<[LocalReminderType, TimeKey]> = [
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
  if (!prefs.pushNotifications) {
    await setArmedAt(null);
    return;
  }

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

  if (notifications.length === 0) {
    await setArmedAt(null);
    return;
  }
  await ensureReminderChannel();
  try {
    await LocalNotifications.schedule({ notifications });
    await setArmedAt(new Date().toISOString());
  } catch (err) {
    console.warn('[localReminders] schedule failed', err);
  }
}

// timestamp reminders were last armed — backfill only counts fires after this
async function setArmedAt(iso: string | null): Promise<void> {
  try {
    if (iso) await Preferences.set({ key: ARMED_KEY, value: iso });
    else await Preferences.remove({ key: ARMED_KEY });
  } catch {
    // best-effort
  }
}

export async function getReminderArmedAt(): Promise<Date | null> {
  try {
    const { value } = await Preferences.get({ key: ARMED_KEY });
    return value ? new Date(value) : null;
  } catch {
    return null;
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

// reminders whose today fire-time falls in (armedAt, now] — i.e. actually fired
export function remindersFiredSince(
  p: ReminderTimes,
  now: Date,
  armedAt: Date | null,
): LocalReminderType[] {
  if (!p.pushNotifications || !armedAt) return [];
  const fired: LocalReminderType[] = [];
  for (const [type, key] of SLOTS) {
    const at = parseHHMM(p[key]);
    if (!at) continue;
    const inst = new Date(now);
    inst.setHours(at.hour, at.minute, 0, 0);
    if (inst >= armedAt && inst <= now) fired.push(type);
  }
  return fired;
}

export function addLocalReminderListeners(
  onNavigate: (route: string) => void,
  onFire: (type: LocalReminderType) => void,
): () => void {
  if (!isLocalRemindersSupported()) return () => {};

  const received = LocalNotifications.addListener('localNotificationReceived', (n) => {
    const type = (n.extra as Record<string, string> | undefined)?.type;
    if (type) onFire(type as LocalReminderType);
  });

  const tapped = LocalNotifications.addListener(
    'localNotificationActionPerformed',
    ({ notification }) => {
      const extra = notification.extra as Record<string, string> | undefined;
      if (extra?.type) onFire(extra.type as LocalReminderType);
      onNavigate(extra?.route ?? '/notifications');
    },
  );

  return () => {
    void received.then((l) => l.remove());
    void tapped.then((l) => l.remove());
  };
}
