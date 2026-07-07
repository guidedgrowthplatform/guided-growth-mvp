/**
 * weeklyProjectionData — the five projection frames' grid math (Lane A A2,
 * onboarding-consolidation-plan-2026-07-06), PORTED from the render's
 * beats/weeklyProjection.tsx (branch flow-annotated-render; behavior locked
 * with Yair 2026-07-05):
 *
 *   - The week STARTS on the user's start day (today), not always Sunday: day
 *     letters and cells rotate to begin on the start weekday.
 *   - The three coach rituals are weekday-only (weekends show as off/gray).
 *   - blank: every scheduled day empty (gap), starting today.
 *   - full: every scheduled day done.
 *   - p78: pooled dones hit ~78% of reported days, one habit's trailing streak
 *     breaks (its last scheduled day missed).
 *   - p36: target a touch under 36 (hero morning check-in all done, the daily
 *     reflection keeps its last two days), everything else takes a hit.
 *   - gaps: Tuesday, Wednesday, Thursday empty top to bottom (never reported);
 *     the other days a mix of done and misses.
 *   - The header percent counts done out of REPORTED days (done + missed);
 *     never-reported gaps are the separate story and do not drag it down.
 *     Per-row done/scheduled chips keep the app grid's own semantics
 *     (scheduled = every non-off cell, matching useWeekData.mapper).
 *
 * Streak math (trailingStreak + BASE_STREAK) is ported and exported for when
 * the shared WeeklyHabitsSummary gains its streak column (the
 * weekly-summary-component workstream owns that component's API; this module
 * only FEEDS it). Pure module: no React, no IO, deterministic PRNG so frames
 * are stable across renders.
 *
 * NO EM DASHES.
 */
import type { HabitWeekCell } from '@/components/habit-detail/WeeklyHabitsSummary';

export type ProjectionState = 'blank' | 'full' | 'p78' | 'p36' | 'gaps';

export interface ScheduledHabit {
  name: string;
  /** JS weekday numbers, 0=Sun..6=Sat. Empty = daily. */
  days: number[];
}

// Three rituals every user gets: weekdays on, weekends off (rest), per Yair.
export const COACH_HABITS: ScheduledHabit[] = [
  { name: 'Morning state check-in', days: [1, 2, 3, 4, 5] },
  { name: 'Evening habit report', days: [1, 2, 3, 4, 5] },
  { name: 'Daily reflection', days: [1, 2, 3, 4, 5] },
];

// W3-B: the morning row is the only one of the three that the user can
// explicitly refuse during onboarding (submit_morning_checkin's server-side
// setup-config guard, B58/!478). Server truth only: the row must not appear
// unless answers.morningCheckin genuinely exists. Evening habit report and
// Daily reflection are unconditional per Yair (out of this fix's scope).
const MORNING_RITUAL_INDEX = 0;

// Sample captured habits for previews / users with none captured yet.
export const SAMPLE_USER_HABITS: ScheduledHabit[] = [
  { name: 'Meditate', days: [0, 1, 2, 3, 4, 5, 6] },
  { name: 'Workout', days: [1, 3, 5] },
  { name: 'Read 10 pages', days: [0, 1, 2, 3, 4, 5, 6] },
  { name: 'No phone in bed', days: [0, 1, 2, 3, 4, 5, 6] },
  { name: 'Journal', days: [0, 1, 2, 3, 4, 5, 6] },
];

// Accumulated streak per habit index (rituals first, then captured habits).
// Only the best case (full) shows these big numbers; realistic frames show the
// small this-week trailing run.
const BASE_STREAK = [84, 79, 62, 47, 26, 33, 58, 19];

const LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** The 7 weekday numbers in display order, beginning at `start` (0=Sun..6). */
export function dayOrderFrom(start: number): number[] {
  return Array.from({ length: 7 }, (_, i) => (start + i) % 7);
}

/** Single-letter day labels in display order for a start weekday. */
export function dayLabelsFrom(start: number): string[] {
  return dayOrderFrom(start).map((wd) => LABELS[wd]);
}

export interface ProjectionRow {
  name: string;
  cells: HabitWeekCell[];
  /** Done cells (the app grid's right-column chip numerator). */
  done: number;
  /** Every non-off cell, gaps included (useWeekData.mapper semantics). */
  scheduled: number;
  /** Trailing streak (full = accumulated BASE_STREAK), for the streak column
   * once the shared grid carries one. */
  streak: number;
}

// Tiny deterministic PRNG: stable frames across re-renders, organic per cell.
function rand(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Consecutive 'done' from the end, skipping 'off'; stops at 'missed' or 'gap'.
export function trailingStreak(cells: HabitWeekCell[]): number {
  let s = 0;
  for (let ci = cells.length - 1; ci >= 0; ci--) {
    const c = cells[ci];
    if (c === 'off') continue;
    if (c === 'done') s += 1;
    else break;
  }
  return s;
}

function toRows(
  habits: ScheduledHabit[],
  cellsByHabit: HabitWeekCell[][],
  useBaseStreak: boolean,
): ProjectionRow[] {
  return habits.map((h, hi) => {
    const cells = cellsByHabit[hi];
    const done = cells.filter((c) => c === 'done').length;
    const scheduled = cells.filter((c) => c !== 'off').length;
    return {
      name: h.name,
      cells,
      done,
      scheduled,
      streak: useBaseStreak ? (BASE_STREAK[hi] ?? 21) : trailingStreak(cells),
    };
  });
}

/** Build the projected rows for a frame, in the given display day order. */
export function buildProjectionRows(
  habits: ScheduledHabit[],
  state: ProjectionState,
  dayOrder: number[],
): ProjectionRow[] {
  const sched = habits.map((h) => {
    const set = new Set(h.days && h.days.length ? h.days : [0, 1, 2, 3, 4, 5, 6]);
    return dayOrder.map((wd) => set.has(wd));
  });

  if (state === 'blank') {
    return toRows(
      habits,
      habits.map((_, hi) => dayOrder.map((_wd, ci) => (sched[hi][ci] ? 'gap' : 'off'))),
      false,
    );
  }

  if (state === 'full') {
    return toRows(
      habits,
      habits.map((_, hi) => dayOrder.map((_wd, ci) => (sched[hi][ci] ? 'done' : 'off'))),
      true,
    );
  }

  if (state === 'gaps') {
    const EMPTY = new Set([2, 3, 4]); // Tue, Wed, Thu (weekday numbers)
    return toRows(
      habits,
      habits.map((_, hi) =>
        dayOrder.map((wd, ci) => {
          if (EMPTY.has(wd)) return 'gap';
          if (!sched[hi][ci]) return 'off';
          return rand(hi * 131 + ci * 17 + 71) < 0.6 ? 'done' : 'missed';
        }),
      ),
      false,
    );
  }

  // p78 / p36: pool the done cells to hit the target percent of scheduled days;
  // everything else scheduled is a miss. p36 keeps the morning check-in as the
  // hero survivor and targets a touch under 36 (hero + reflection tail add
  // guaranteed dones).
  const targetPct = state === 'p78' ? 78 : 31;
  const heroes = state === 'p78' ? [] : [0];
  const salt = state === 'p78' ? 20 : 34;

  let totalSched = 0;
  let heroDone = 0;
  const pool: { hi: number; ci: number; pri: number }[] = [];
  habits.forEach((_, hi) =>
    sched[hi].forEach((s, ci) => {
      if (!s) return;
      totalSched += 1;
      if (heroes.includes(hi)) heroDone += 1;
      else pool.push({ hi, ci, pri: rand(hi * 131 + ci * 17 + salt) });
    }),
  );
  const targetDone = Math.round((targetPct / 100) * totalSched);
  const fromPool = Math.max(0, Math.min(targetDone - heroDone, pool.length));
  pool.sort((a, b) => a.pri - b.pri);
  const doneSet = new Set(pool.slice(0, fromPool).map((c) => `${c.hi}:${c.ci}`));

  const cells = habits.map((_, hi) =>
    dayOrder.map((_wd, ci) => {
      if (!sched[hi][ci]) return 'off' as HabitWeekCell;
      if (heroes.includes(hi)) return 'done' as HabitWeekCell;
      return (doneSet.has(`${hi}:${ci}`) ? 'done' : 'missed') as HabitWeekCell;
    }),
  );

  // p78: exactly one trailing streak breaks (the 4th habit's last scheduled day).
  if (state === 'p78' && habits.length > 3) {
    const mi = 3;
    const schedCols = dayOrder.map((_wd, ci) => ci).filter((ci) => sched[mi][ci]);
    const last = schedCols[schedCols.length - 1];
    if (last != null) cells[mi][last] = 'missed';
  }

  // p36: the daily reflection keeps its last two scheduled days (a small
  // surviving streak beside the hero).
  if (state === 'p36' && habits.length > 2) {
    const ri = 2;
    const schedCols = dayOrder.map((_wd, ci) => ci).filter((ci) => sched[ri][ci]);
    for (const ci of schedCols.slice(-2)) cells[ri][ci] = 'done';
  }

  return toRows(habits, cells, false);
}

/**
 * Header stats: done out of REPORTED days (done + missed). Gaps and off days
 * are excluded, so never-reporting reads as its own story, not a low percent.
 */
export function projectionStats(rows: ProjectionRow[]): {
  done: number;
  reported: number;
  percent: number;
} {
  let done = 0;
  let reported = 0;
  for (const row of rows) {
    for (const c of row.cells) {
      if (c === 'off' || c === 'gap') continue;
      reported += 1;
      if (c === 'done') done += 1;
    }
  }
  return { done, reported, percent: reported ? Math.round((done / reported) * 100) : 0 };
}

/**
 * The habit list a projection frame renders: the three rituals, then the
 * user's real captured habits (name + days from the flow answers), falling
 * back to the sample set when nothing is captured yet (previews, QA).
 *
 * `morningConfigured` gates the "Morning state check-in" ritual row: absence
 * (refused or never reached) means the row must not render at all, never a
 * default-scheduled row implying it was set up. Defaults to true so existing
 * previews/QA fixtures that don't pass it keep the prior always-on behavior.
 */
export function projectionHabits(
  habitConfigs: Record<string, { days: number[] | Set<number> }> | null | undefined,
  morningConfigured = true,
): ScheduledHabit[] {
  const captured = Object.entries(habitConfigs ?? {})
    .map(([name, cfg]) => ({
      name,
      days: Array.isArray(cfg.days) ? cfg.days : [...(cfg.days ?? [])],
    }))
    .slice(0, 5);
  const rituals = morningConfigured
    ? COACH_HABITS
    : COACH_HABITS.filter((_, i) => i !== MORNING_RITUAL_INDEX);
  return [...rituals, ...(captured.length > 0 ? captured : SAMPLE_USER_HABITS)];
}
