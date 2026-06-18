import { beforeEach, describe, expect, it, vi } from 'vitest';

const isNativePlatform = vi.fn(() => true);
const getPlatform = vi.fn(() => 'ios');
const checkPermissions = vi.fn(async () => ({ display: 'granted' }));
const requestPermissions = vi.fn(async () => ({ display: 'granted' }));
const schedule = vi.fn(async (_o: unknown) => undefined);
const cancel = vi.fn(async (_o: unknown) => undefined);

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => isNativePlatform(), getPlatform: () => getPlatform() },
}));
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: () => checkPermissions(),
    requestPermissions: () => requestPermissions(),
    schedule: (o: unknown) => schedule(o),
    cancel: (o: unknown) => cancel(o),
    checkExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
    changeExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
  },
}));
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
  });

  it('web no-ops', async () => {
    isNativePlatform.mockReturnValue(false);
    const { rescheduleReminders } = await load();
    await rescheduleReminders(prefs);
    expect(schedule).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('cancels then schedules both when granted', async () => {
    const { rescheduleReminders } = await load();
    await rescheduleReminders(prefs);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledTimes(1);
    const arg = schedule.mock.calls[0][0] as { notifications: unknown[] };
    expect(arg.notifications).toHaveLength(2);
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

  it('skips slots with unparseable times', async () => {
    const { rescheduleReminders } = await load();
    await rescheduleReminders({ ...prefs, nightTime: 'nope' });
    const arg = schedule.mock.calls[0][0] as { notifications: unknown[] };
    expect(arg.notifications).toHaveLength(1);
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
