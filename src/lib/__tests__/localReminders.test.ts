import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REMINDER_VARIANTS, reminderVariantIndex } from '@gg/shared';

const isNativePlatform = vi.fn(() => true);
const getPlatform = vi.fn(() => 'ios');
const checkPermissions = vi.fn(async () => ({ display: 'granted' }));
const requestPermissions = vi.fn(async () => ({ display: 'granted' }));
const schedule = vi.fn(async (_o: unknown) => undefined);
const cancel = vi.fn(async (_o: unknown) => undefined);
const registerActionTypes = vi.fn(async (_o: unknown) => undefined);
const removeDeliveredNotifications = vi.fn(async (_o: unknown) => undefined);
const track = vi.fn();

type ActionCb = (p: { actionId: string; notification: unknown }) => void;
let actionPerformedCb: ActionCb | undefined;
const addListener = vi.fn(async (event: string, cb: ActionCb) => {
  if (event === 'localNotificationActionPerformed') actionPerformedCb = cb;
  return { remove: vi.fn() };
});

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => isNativePlatform(), getPlatform: () => getPlatform() },
}));
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: () => checkPermissions(),
    requestPermissions: () => requestPermissions(),
    schedule: (o: unknown) => schedule(o),
    cancel: (o: unknown) => cancel(o),
    registerActionTypes: (o: unknown) => registerActionTypes(o),
    removeDeliveredNotifications: (o: unknown) => removeDeliveredNotifications(o),
    addListener: (e: string, cb: ActionCb) => addListener(e, cb),
    checkExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
    changeExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
  },
}));
vi.mock('@/analytics/posthog', () => ({ track: (...a: unknown[]) => track(...a) }));
vi.mock('@capacitor/preferences', () => {
  let armed: string | undefined;
  return {
    Preferences: {
      get: async () => ({ value: armed ?? null }),
      set: async ({ value }: { value: string }) => {
        armed = value;
      },
      remove: async () => {
        armed = undefined;
      },
    },
  };
});
vi.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ user: { name: 'Sam Smith', nickname: null } }) },
}));

async function load() {
  vi.resetModules();
  return import('../localReminders');
}

const prefs = {
  morningTime: '07:00',
  nightTime: '22:30',
  pushNotifications: true,
  firstName: 'Sam',
};

describe('rescheduleReminders', () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(true);
    getPlatform.mockReturnValue('ios');
    checkPermissions.mockResolvedValue({ display: 'granted' });
    schedule.mockClear();
    cancel.mockClear();
    registerActionTypes.mockClear();
  });

  it('web no-ops', async () => {
    isNativePlatform.mockReturnValue(false);
    const { rescheduleReminders } = await load();
    await rescheduleReminders(prefs);
    expect(schedule).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('cancels then schedules when granted', async () => {
    const { rescheduleReminders } = await load();
    await rescheduleReminders(prefs);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledTimes(1);
    const arg = schedule.mock.calls[0][0] as { notifications: unknown[] };
    expect(arg.notifications.length).toBeGreaterThan(0);
  });

  it('attaches the reminder_actions action type to each notification', async () => {
    const { rescheduleReminders } = await load();
    await rescheduleReminders(prefs);
    const arg = schedule.mock.calls[0][0] as { notifications: { actionTypeId: string }[] };
    expect(arg.notifications.every((n) => n.actionTypeId === 'reminder_actions')).toBe(true);
  });

  it('registers the action type before scheduling', async () => {
    const { rescheduleReminders } = await load();
    await rescheduleReminders(prefs);
    expect(registerActionTypes).toHaveBeenCalled();
    expect(registerActionTypes.mock.invocationCallOrder[0]).toBeLessThan(
      schedule.mock.invocationCallOrder[0],
    );
  });

  it('pushNotifications=false cancels and schedules nothing', async () => {
    const { rescheduleReminders } = await load();
    await rescheduleReminders({ ...prefs, pushNotifications: false });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(schedule).not.toHaveBeenCalled();
  });

  it('permission not granted → no schedule', async () => {
    checkPermissions.mockResolvedValue({ display: 'denied' });
    const { rescheduleReminders } = await load();
    await rescheduleReminders(prefs);
    expect(schedule).not.toHaveBeenCalled();
  });

  it('cancels the full id range', async () => {
    const { rescheduleReminders } = await load();
    await rescheduleReminders(prefs);
    const arg = cancel.mock.calls[0][0] as { notifications: { id: number }[] };
    expect(arg.notifications.map((n) => n.id)).toEqual([
      1001, 1002, 1003, 1004, 1005, 1006, 1007, 1011, 1012, 1013, 1014, 1015, 1016, 1017,
    ]);
  });
});

describe('buildReminderSchedule', () => {
  // Thu 06:00 local — past today's 05:00? no; before morning 07:00 + evening 22:30
  const now = new Date('2026-06-18T06:00:00');

  it('schedules the rolling window per slot, skipping past slots', async () => {
    const { buildReminderSchedule } = await load();
    const out = buildReminderSchedule(prefs, now);
    // both today slots still future (07:00, 22:30) → 7 + 7
    expect(out).toHaveLength(14);
    expect(out.map((n) => n.id)).toEqual([
      1001, 1002, 1003, 1004, 1005, 1006, 1007, 1011, 1012, 1013, 1014, 1015, 1016, 1017,
    ]);
  });

  it('skips a slot whose fire-time today already passed', async () => {
    const { buildReminderSchedule } = await load();
    const afterMorning = new Date('2026-06-18T08:00:00');
    const out = buildReminderSchedule(prefs, afterMorning);
    // morning today (07:00) passed → only days 1..6 for morning + full 7 evenings
    const morningIds = out.filter((n) => n.id < 1011).map((n) => n.id);
    expect(morningIds).toEqual([1002, 1003, 1004, 1005, 1006, 1007]);
    expect(out.filter((n) => n.id >= 1011)).toHaveLength(7);
  });

  it('skips slots with unparseable times', async () => {
    const { buildReminderSchedule } = await load();
    const out = buildReminderSchedule({ ...prefs, nightTime: 'nope' }, now);
    expect(out.every((n) => n.id < 1011)).toBe(true);
    expect(out).toHaveLength(7);
  });

  it('fire dates land on the slot hour/minute', async () => {
    const { buildReminderSchedule } = await load();
    const out = buildReminderSchedule(prefs, now);
    const firstMorning = out.find((n) => n.id === 1001)!;
    const at = firstMorning.schedule!.at as Date;
    expect(at.getHours()).toBe(7);
    expect(at.getMinutes()).toBe(0);
    expect(at.getDate()).toBe(18);
    const lastEvening = out.find((n) => n.id === 1017)!;
    const atE = lastEvening.schedule!.at as Date;
    expect(atE.getHours()).toBe(22);
    expect(atE.getMinutes()).toBe(30);
    expect(atE.getDate()).toBe(24);
  });

  it('copy matches the rotation variant for each fire date', async () => {
    const { buildReminderSchedule } = await load();
    const out = buildReminderSchedule(prefs, now);
    for (const n of out) {
      const type = n.id < 1011 ? 'morning_checkin' : 'evening_checkin';
      const idx = reminderVariantIndex(n.schedule!.at as Date);
      const v = REMINDER_VARIANTS[type][idx];
      expect(n.title).toBe(v.title);
      expect(n.body).toBe(v.body);
    }
  });
});

describe('registerReminderActionTypes', () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(true);
    registerActionTypes.mockClear();
  });

  it('registers continue + delete actions', async () => {
    const { registerReminderActionTypes } = await load();
    await registerReminderActionTypes();
    const arg = registerActionTypes.mock.calls[0][0] as {
      types: { id: string; actions: { id: string }[] }[];
    };
    expect(arg.types[0].id).toBe('reminder_actions');
    expect(arg.types[0].actions.map((a) => a.id)).toEqual(['continue', 'delete']);
  });

  it('web no-ops', async () => {
    isNativePlatform.mockReturnValue(false);
    const { registerReminderActionTypes } = await load();
    await registerReminderActionTypes();
    expect(registerActionTypes).not.toHaveBeenCalled();
  });
});

describe('addLocalReminderListeners — action handling', () => {
  const notif = {
    id: 1001,
    title: 'Hi Sam!',
    body: 'morning',
    extra: { type: 'morning_checkin', route: '/home' },
  };
  let onNavigate: ReturnType<typeof vi.fn>;
  let onFire: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    isNativePlatform.mockReturnValue(true);
    track.mockClear();
    removeDeliveredNotifications.mockClear();
    actionPerformedCb = undefined;
    onNavigate = vi.fn();
    onFire = vi.fn();
    const { addLocalReminderListeners } = await load();
    addLocalReminderListeners(onNavigate, onFire);
  });

  it('delete → clears shade, no feed entry, no navigate', () => {
    actionPerformedCb?.({ actionId: 'delete', notification: notif });
    expect(onFire).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(removeDeliveredNotifications).toHaveBeenCalledWith({
      notifications: [{ id: 1001, title: 'Hi Sam!', body: 'morning' }],
    });
    expect(track).toHaveBeenCalledWith('tap_notification_delete', {
      reminder_type: 'morning_checkin',
    });
  });

  it('continue → records feed + navigates, no shade clear', () => {
    actionPerformedCb?.({ actionId: 'continue', notification: notif });
    expect(onFire).toHaveBeenCalledWith('morning_checkin');
    expect(onNavigate).toHaveBeenCalledWith('/home');
    expect(removeDeliveredNotifications).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('tap_notification_continue', {
      reminder_type: 'morning_checkin',
    });
  });

  it('default body tap → navigates, no tracking, no shade clear', () => {
    actionPerformedCb?.({ actionId: 'tap', notification: notif });
    expect(onFire).toHaveBeenCalledWith('morning_checkin');
    expect(onNavigate).toHaveBeenCalledWith('/home');
    expect(track).not.toHaveBeenCalled();
    expect(removeDeliveredNotifications).not.toHaveBeenCalled();
  });

  it('missing type → navigates to /notifications, no onFire', () => {
    actionPerformedCb?.({
      actionId: 'tap',
      notification: { id: 1001, title: 't', body: 'b', extra: {} },
    });
    expect(onFire).not.toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith('/notifications');
  });
});

describe('currentFirstName', () => {
  it('falls back to first word of name', async () => {
    const { currentFirstName } = await load();
    expect(currentFirstName()).toBe('Sam');
  });
});

describe('remindersFiredSince', () => {
  const times = { morningTime: '07:00', nightTime: '22:30', pushNotifications: true };
  const armedYesterday = new Date(2026, 5, 17, 9, 0);

  it('returns slots that fired after armedAt and before now', async () => {
    const { remindersFiredSince } = await load();
    const at0800 = new Date(2026, 5, 18, 8, 0);
    expect(remindersFiredSince(times, at0800, armedYesterday)).toEqual(['morning_checkin']);
    const at2300 = new Date(2026, 5, 18, 23, 0);
    expect(remindersFiredSince(times, at2300, armedYesterday)).toEqual([
      'morning_checkin',
      'evening_checkin',
    ]);
  });

  it('excludes a slot armed after its time today (no phantom)', async () => {
    const { remindersFiredSince } = await load();
    const armedAt9 = new Date(2026, 5, 18, 9, 0);
    const now = new Date(2026, 5, 18, 10, 0);
    expect(remindersFiredSince(times, now, armedAt9)).toEqual([]);
  });

  it('empty when never armed or push off', async () => {
    const { remindersFiredSince } = await load();
    const now = new Date(2026, 5, 18, 23, 0);
    expect(remindersFiredSince(times, now, null)).toEqual([]);
    expect(
      remindersFiredSince({ ...times, pushNotifications: false }, now, armedYesterday),
    ).toEqual([]);
  });
});
