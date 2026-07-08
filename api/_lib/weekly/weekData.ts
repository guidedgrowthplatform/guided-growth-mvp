import pool from '../db.js';

// ─── Types ──────────────────────────────────────────────────────────────
// The Weekly's data payload: a 7-day window (ending weekEnd inclusive)
// across habits, state check-ins, and reflections, plus enough of the prior
// weekly session to let the coach reference it ("last week you said...").

type HabitDayCellStatus = 'done' | 'missed' | 'pending';

interface WeekDataHabitDay {
  date: string; // yyyy-MM-dd
  scheduled: boolean;
  status: HabitDayCellStatus;
}

interface WeekDataHabit {
  name: string;
  polarity: 'build' | 'break';
  cadence: string;
  scheduleDays: number[] | null;
  days: WeekDataHabitDay[];
  doneCount: number;
  scheduledCount: number;
}

interface WeekDataState {
  sleep: Array<number | null>;
  mood: Array<number | null>;
  energy: Array<number | null>;
  stress: Array<number | null>;
  datesLogged: number;
}

interface WeekDataReflection {
  date: string;
  text: string;
}

interface WeekDataLastWeek {
  focus: string | null;
  changes: unknown[];
}

export interface WeekData {
  weekStart: string; // yyyy-MM-dd, 6 days before weekEnd
  weekEnd: string; // yyyy-MM-dd
  loggedDays: number;
  thinData: boolean;
  weekNumber: number;
  habits: WeekDataHabit[];
  state: WeekDataState;
  reflections: WeekDataReflection[];
  lastWeek: WeekDataLastWeek | null;
}

type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

// ─── Small date helpers (plain yyyy-MM-dd string math, no external tz) ──

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sunday
}

function windowDates(weekEnd: string): string[] {
  // 7 days ending weekEnd inclusive, oldest first.
  const start = addDays(weekEnd, -6);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) dates.push(addDays(start, i));
  return dates;
}

// ─── Polarity + schedule helpers ────────────────────────────────────────

// Tolerate both the pre- and post-043 habit_type spellings (see
// 043_rename_habit_polarity.sql — the rename shipped in code but the DB
// check constraint still allows the old values, and existing rows use them).
function polarityFromHabitType(habitType: string): 'build' | 'break' {
  return habitType === 'binary_avoid' || habitType === 'binary_break' ? 'break' : 'build';
}

// null/empty schedule_days = cadence-default (daily); otherwise explicit days.
function isScheduled(scheduleDays: number[] | null, dow: number): boolean {
  if (!scheduleDays || scheduleDays.length === 0) return true;
  return scheduleDays.includes(dow);
}

// ─── Reflection text: defensive against legacy client-side-encrypted content ──

// Client-side AES-GCM ciphertext (src/lib/utils/journal-crypto.ts) is stored as
// "base64(iv).base64(ciphertext)" — two base64 blocks joined by exactly one
// dot, no whitespace, no natural-language punctuation. The server has no way
// to decrypt it (the key is derived from auth.users.id, never sent to pg), so
// treat anything shaped like that as opaque and drop it rather than surface
// ciphertext to the coach.
const BASE64_SEGMENT = /^[A-Za-z0-9+/]+=*$/;

function looksEncrypted(text: string): boolean {
  if (/\s/.test(text)) return false; // real sentences have whitespace
  const parts = text.split('.');
  if (parts.length !== 2) return false;
  return parts.every((p) => p.length >= 8 && BASE64_SEGMENT.test(p));
}

// Broader "is this plausibly human text" gate: printable, has at least one
// space-separated word of reasonable length, isn't pure base64-looking noise.
function isPlausibleText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (looksEncrypted(trimmed)) return false;
  // A single unbroken run of base64-alphabet characters with no spaces and
  // no sentence punctuation, longer than any real one-word reflection would
  // be, is almost certainly leftover ciphertext or another opaque blob.
  if (!/\s/.test(trimmed) && trimmed.length > 40 && BASE64_SEGMENT.test(trimmed)) return false;
  return true;
}

function trimReflection(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 240 ? `${trimmed.slice(0, 239).trimEnd()}…` : trimmed;
}

// ─── buildWeekData ───────────────────────────────────────────────────────

export async function buildWeekData(
  client: Queryable,
  anonId: string,
  weekEnd: string,
): Promise<WeekData> {
  const dates = windowDates(weekEnd);
  const weekStart = dates[0];

  // Note: reflection_settings.weekly_day (added in migration 055) is the
  // user's chosen day-of-week for The Weekly. It drives WHEN this gets built
  // (the check-in routing layer's job, see beatContexts/useCheckinEntry), not
  // what's IN the payload, so it isn't read here.
  const [habitsRes, completionsRes, checkinsRes, journalRes, sessionCountRes, lastWeekRes] =
    await Promise.all([
      client.query(
        `SELECT id, name, habit_type, cadence, schedule_days FROM user_habits
          WHERE anon_id = $1 AND is_active = true AND archived_at IS NULL
          ORDER BY sort_order ASC`,
        [anonId],
      ),
      client.query(
        `SELECT hc.habit_id, hc.date::text AS date, hc.status
           FROM habit_completions hc
           JOIN user_habits uh ON uh.id = hc.habit_id
          WHERE hc.anon_id = $1 AND hc.date >= $2 AND hc.date <= $3`,
        [anonId, weekStart, weekEnd],
      ),
      client.query(
        `SELECT date::text AS date, sleep, mood, energy, stress FROM daily_checkins
          WHERE anon_id = $1 AND date >= $2 AND date <= $3
          ORDER BY date ASC`,
        [anonId, weekStart, weekEnd],
      ),
      client.query(
        `SELECT je.id, je.date::text AS date, jef.field_key, jef.content
           FROM journal_entries je
           LEFT JOIN journal_entry_fields jef ON jef.entry_id = je.id
          WHERE je.anon_id = $1 AND je.date >= $2 AND je.date <= $3
          ORDER BY je.date ASC, je.created_at ASC`,
        [anonId, weekStart, weekEnd],
      ),
      client.query(`SELECT count(*)::int AS n FROM weekly_sessions WHERE anon_id = $1`, [anonId]),
      client.query(
        `SELECT focus, changes FROM weekly_sessions
          WHERE anon_id = $1 AND completed_at IS NOT NULL
          ORDER BY week_end DESC LIMIT 1`,
        [anonId],
      ),
    ]);

  // ── Habits + 3-state day grid ──
  const habitRows = habitsRes.rows as Array<{
    id: string;
    name: string;
    habit_type: string;
    cadence: string;
    schedule_days: number[] | null;
  }>;
  const completionRows = completionsRes.rows as Array<{
    habit_id: string;
    date: string;
    status: string;
  }>;

  const completionsByHabit = new Map<string, Map<string, string>>();
  for (const row of completionRows) {
    let byDate = completionsByHabit.get(row.habit_id);
    if (!byDate) {
      byDate = new Map();
      completionsByHabit.set(row.habit_id, byDate);
    }
    byDate.set(row.date, row.status);
  }

  const habits: WeekDataHabit[] = habitRows.map((h) => {
    const byDate = completionsByHabit.get(h.id);
    let doneCount = 0;
    let scheduledCount = 0;
    const days: WeekDataHabitDay[] = dates.map((date) => {
      const scheduled = isScheduled(h.schedule_days, dayOfWeek(date));
      if (scheduled) scheduledCount++;
      const rawStatus = byDate?.get(date);
      const status: HabitDayCellStatus =
        rawStatus === 'done' ? 'done' : rawStatus === 'missed' ? 'missed' : 'pending';
      if (status === 'done') doneCount++;
      return { date, scheduled, status };
    });
    return {
      name: h.name,
      polarity: polarityFromHabitType(h.habit_type),
      cadence: h.cadence,
      scheduleDays: h.schedule_days,
      days,
      doneCount,
      scheduledCount,
    };
  });

  // ── State check-ins ──
  const checkinRows = checkinsRes.rows as Array<{
    date: string;
    sleep: number | null;
    mood: number | null;
    energy: number | null;
    stress: number | null;
  }>;
  const checkinByDate = new Map(checkinRows.map((r) => [r.date, r]));
  const state: WeekDataState = {
    sleep: dates.map((d) => checkinByDate.get(d)?.sleep ?? null),
    mood: dates.map((d) => checkinByDate.get(d)?.mood ?? null),
    energy: dates.map((d) => checkinByDate.get(d)?.energy ?? null),
    stress: dates.map((d) => checkinByDate.get(d)?.stress ?? null),
    datesLogged: checkinRows.length,
  };

  // ── Reflections: concatenate every field's content per entry, skip
  // undecryptable/opaque content, trim to 240 chars ──
  const journalFieldRows = journalRes.rows as Array<{
    id: string;
    date: string;
    field_key: string | null;
    content: string | null;
  }>;
  const entryTextById = new Map<string, { date: string; parts: string[] }>();
  for (const row of journalFieldRows) {
    let entry = entryTextById.get(row.id);
    if (!entry) {
      entry = { date: row.date, parts: [] };
      entryTextById.set(row.id, entry);
    }
    if (row.content && isPlausibleText(row.content)) {
      entry.parts.push(row.content.trim());
    }
  }
  const reflections: WeekDataReflection[] = [...entryTextById.values()]
    .filter((e) => e.parts.length > 0)
    .map((e) => ({ date: e.date, text: trimReflection(e.parts.join(' ')) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // ── Meta ──
  const loggedDates = new Set<string>();
  for (const row of completionRows) loggedDates.add(row.date);
  for (const row of checkinRows) loggedDates.add(row.date);
  for (const entry of entryTextById.values()) {
    if (entry.parts.length > 0) loggedDates.add(entry.date);
  }
  const loggedDays = loggedDates.size;
  const thinData = loggedDays < 3;

  const weekNumber = ((sessionCountRes.rows[0] as { n?: number } | undefined)?.n ?? 0) + 1;

  const lastWeekRow = lastWeekRes.rows[0] as { focus: string | null; changes: unknown } | undefined;
  const lastWeek: WeekDataLastWeek | null = lastWeekRow
    ? {
        focus: lastWeekRow.focus ?? null,
        changes: Array.isArray(lastWeekRow.changes) ? lastWeekRow.changes : [],
      }
    : null;

  return {
    weekStart,
    weekEnd,
    loggedDays,
    thinData,
    weekNumber,
    habits,
    state,
    reflections,
    lastWeek,
  };
}

// ─── renderWeekDataBlock ─────────────────────────────────────────────────

const DAY_CELL_MARKERS: Record<HabitDayCellStatus | 'off', string> = {
  done: 'x',
  missed: 'm',
  pending: '.',
  off: '_',
};

function habitDayMarker(day: WeekDataHabitDay): string {
  if (!day.scheduled) return DAY_CELL_MARKERS.off;
  return DAY_CELL_MARKERS[day.status];
}

function formatDimensionLine(label: string, values: Array<number | null>): string {
  const cells = values.map((v) => (v === null ? '-' : String(v)));
  const present = values.filter((v): v is number => v !== null);
  const avg =
    present.length > 0 ? (present.reduce((sum, v) => sum + v, 0) / present.length).toFixed(1) : '-';
  return `${label}: ${cells.join(' ')} (avg ${avg})`;
}

// Compact plain-text block for the LLM system context. No em dashes anywhere.
export function renderWeekDataBlock(week: WeekData): string {
  const lines: string[] = [];
  lines.push(`WEEK DATA (${week.weekStart} to ${week.weekEnd})`);
  lines.push('');

  if (week.habits.length > 0) {
    lines.push('Habits (x done, m missed, . pending, _ not scheduled):');
    for (const habit of week.habits) {
      const markers = habit.days.map(habitDayMarker).join(' ');
      lines.push(
        `- ${habit.name} [${habit.polarity}]: ${markers}  (${habit.doneCount}/${habit.scheduledCount})`,
      );
    }
  } else {
    lines.push('Habits: none active this week.');
  }

  lines.push('');
  lines.push('State check-ins (1-5 scale, - = not logged):');
  lines.push(formatDimensionLine('Sleep', week.state.sleep));
  lines.push(formatDimensionLine('Mood', week.state.mood));
  lines.push(formatDimensionLine('Energy', week.state.energy));
  lines.push(formatDimensionLine('Stress', week.state.stress));

  lines.push('');
  if (week.reflections.length > 0) {
    lines.push('Reflections:');
    for (const r of week.reflections) lines.push(`${r.date}: ${r.text}`);
  } else {
    lines.push('Reflections: none logged this week.');
  }

  lines.push('');
  lines.push(
    `Meta: week ${week.weekNumber}, ${week.loggedDays} of 7 days logged${week.thinData ? ', thin data' : ''}.`,
  );

  if (week.lastWeek) {
    const changeCount = week.lastWeek.changes.length;
    const focusPart = week.lastWeek.focus
      ? `focus was "${week.lastWeek.focus}"`
      : 'no focus recorded';
    lines.push(
      `Last week: ${focusPart}, ${changeCount} plan change${changeCount === 1 ? '' : 's'}.`,
    );
  }

  return lines.join('\n');
}

// ─── buildWeekGridPayload ────────────────────────────────────────────────

type HabitWeekCell = 'done' | 'missed' | 'gap' | 'off';

interface WeekGridRow {
  name: string;
  cells: HabitWeekCell[];
  done: number;
  scheduled: number;
}

export interface WeekGridPayload {
  overallPercent: number;
  overallDone: number;
  overallScheduled: number;
  rows: WeekGridRow[];
}

function gridCell(day: WeekDataHabitDay): HabitWeekCell {
  if (!day.scheduled) return 'off';
  if (day.status === 'done') return 'done';
  if (day.status === 'missed') return 'missed';
  return 'gap'; // scheduled + pending = never reported
}

export function buildWeekGridPayload(week: WeekData): WeekGridPayload {
  const rows: WeekGridRow[] = week.habits.map((habit) => ({
    name: habit.name,
    cells: habit.days.map(gridCell), // window order, oldest first
    done: habit.doneCount,
    scheduled: habit.scheduledCount,
  }));

  const overallDone = rows.reduce((sum, r) => sum + r.done, 0);
  const overallScheduled = rows.reduce((sum, r) => sum + r.scheduled, 0);
  const overallPercent =
    overallScheduled > 0 ? Math.round((overallDone / overallScheduled) * 100) : 0;

  return { overallPercent, overallDone, overallScheduled, rows };
}
