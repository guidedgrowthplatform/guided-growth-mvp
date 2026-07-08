import type { PushNotificationType } from '@gg/shared/types';

export interface SchedulePrefs {
  anon_id: string;
  first_name: string | null;
  timezone: string;
  morning_time: string | null;
  night_time: string | null;
}

export interface DueNotification {
  anon_id: string;
  first_name: string | null;
  type: PushNotificationType;
  local_date: string;
}

// Vercel cron is best-effort (late/skipped runs, no retries) — a wide window
// turns "missed" into "late"; the (anon_id, type, local_date) unique index
// keeps the wide window from double-sending.
const DUE_WINDOW_MINUTES = 60;

const MINUTES_PER_DAY = 24 * 60;

function parseTimeToMinutes(value: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes < MINUTES_PER_DAY ? minutes : null;
}

interface LocalNow {
  minutesSinceMidnight: number;
  isoDate: string;
}

function localNowIn(timezone: string, nowUtc: Date): LocalNow | null {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(nowUtc);
  } catch {
    // unknown/garbage timezone string — skip the user rather than guess
    return null;
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const [year, month, day, hour, minute] = [
    get('year'),
    get('month'),
    get('day'),
    get('hour'),
    get('minute'),
  ];
  if (!year || !month || !day || !hour || !minute) return null;
  return {
    minutesSinceMidnight: Number(hour) * 60 + Number(minute),
    isoDate: `${year}-${month}-${day}`,
  };
}

// calendar-pure (no DST drift): shift the date itself, not the instant
function previousIsoDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return prev.toISOString().slice(0, 10);
}

export function computeDue(
  prefs: SchedulePrefs[],
  nowUtc: Date,
  windowMinutes: number = DUE_WINDOW_MINUTES,
): DueNotification[] {
  const due: DueNotification[] = [];

  for (const p of prefs) {
    const local = localNowIn(p.timezone, nowUtc);
    if (!local) continue;

    const schedules: Array<[PushNotificationType, number | null]> = [
      ['morning_checkin', parseTimeToMinutes(p.morning_time)],
      ['evening_checkin', parseTimeToMinutes(p.night_time)],
    ];

    for (const [type, schedMin] of schedules) {
      if (schedMin === null) continue;

      const sinceSched = local.minutesSinceMidnight - schedMin;
      if (sinceSched >= 0 && sinceSched < windowMinutes) {
        due.push({ anon_id: p.anon_id, first_name: p.first_name, type, local_date: local.isoDate });
        continue;
      }

      // midnight wrap: a 23:30 schedule is still due at 00:15 next day;
      // local_date stays the scheduled day so idempotency survives the boundary
      const sinceSchedYesterday = sinceSched + MINUTES_PER_DAY;
      if (sinceSchedYesterday >= 0 && sinceSchedYesterday < windowMinutes) {
        due.push({
          anon_id: p.anon_id,
          first_name: p.first_name,
          type,
          local_date: previousIsoDate(local.isoDate),
        });
      }
    }
  }

  return due;
}
