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

describe('remindersDueAt', () => {
  const times = { morningTime: '07:00', nightTime: '22:30', pushNotifications: true };

  it('returns slots whose time has passed', async () => {
    const { remindersDueAt } = await load();
    const at0800 = new Date(2026, 5, 18, 8, 0);
    expect(remindersDueAt(times, at0800)).toEqual(['morning_checkin']);
    const at2300 = new Date(2026, 5, 18, 23, 0);
    expect(remindersDueAt(times, at2300)).toEqual(['morning_checkin', 'evening_checkin']);
  });

  it('empty before any time and when push off', async () => {
    const { remindersDueAt } = await load();
    expect(remindersDueAt(times, new Date(2026, 5, 18, 6, 0))).toEqual([]);
    expect(
      remindersDueAt({ ...times, pushNotifications: false }, new Date(2026, 5, 18, 23, 0)),
    ).toEqual([]);
  });
});
