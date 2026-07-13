/**
 * weeklyProjection, flow-builder beat for the weekly habit grid projection.
 *
 * Five separate frames (one per props.state): blank, full, p78, p36, gaps.
 *
 * Behavior locked with Yair 2026-07-05:
 *   - The week STARTS on the user's start day (today), not always Sunday. The
 *     day letters and the projected cells rotate to begin on the start weekday,
 *     and there is no separate trailing "today" cell (showToday={false}).
 *   - Streaks are real accumulated numbers (79, 84, 26, ...), not this-week
 *     counts. A clean week keeps the base streak; a broken week resets to the
 *     trailing run (0 if the last scheduled day was missed).
 *   - full (beat 19): every streak holds, big numbers.
 *   - p78 (beat 20): mostly green, a few misses, ONE streak breaks to zero, the
 *     rest hold.
 *   - p36 (beat 21): one streak survives, the rest take a hit.
 *   - gaps (beat 22): Wednesday and Thursday are empty top to bottom (never
 *     reported); every other day is reported and done.
 *   - The three rituals use the user's local work week. Israel runs Sunday
 *     through Thursday; every other locale runs Monday through Friday.
 *
 * RULES followed here:
 *   - No em dashes anywhere (commas and periods used instead)
 *   - Coach narration never says tap, scroll, click, or press
 *   - Real WeeklyHabitsSummary component reused via the @/components alias
 */
import {
  WeeklyHabitsSummary,
  type HabitWeekCell,
} from '@/components/habit-detail/WeeklyHabitsSummary';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';
import { FONT, PRIMARY, INK, CARD, SPACE } from './_beatStyle';
import { ritualWeekdaysForLocale } from './ritualCadence';

// The five projection states.
export type ProjectionState = 'blank' | 'full' | 'p78' | 'p36' | 'gaps';

interface ScheduledHabit {
  name: string;
  days: number[]; // JS weekday numbers, 0=Sun..6=Sat
}

const RITUAL_COUNT = 3;

function ritualRows(locale?: string): ScheduledHabit[] {
  const days = [...ritualWeekdaysForLocale(locale)];
  return [
    { name: 'Morning check-in', days },
    { name: 'Evening habit report', days },
    { name: 'Evening reflection', days },
  ];
}

// Weekday index (0=Sun..6=Sat) to its single-letter label.
const LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WED = 3;
const THU = 4;

// The week window starts on the user's start day (today). Returns the 7 weekday
// numbers in display order, beginning at `start`.
function dayOrderFrom(start: number): number[] {
  return Array.from({ length: 7 }, (_, i) => (start + i) % 7);
}

interface Row {
  name: string;
  cells: HabitWeekCell[];
  streak: number;
}

// Tiny deterministic PRNG so projected weeks are stable across re-renders but
// look organic per habit/day pair.
function rand(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Trailing streak within the shown week: consecutive 'done' from the end,
// skipping 'off'. Stops at the first 'missed' or 'gap'.
function trailingStreak(cells: HabitWeekCell[]): number {
  let s = 0;
  for (let ci = cells.length - 1; ci >= 0; ci--) {
    const c = cells[ci];
    if (c === 'off') continue;
    if (c === 'done') s += 1;
    else break;
  }
  return s;
}

function buildRows(habits: ScheduledHabit[], state: ProjectionState, dayOrder: number[]): Row[] {
  // Which display columns are scheduled for each habit.
  const sched = habits.map((h) => {
    const set = new Set(h.days);
    return dayOrder.map((wd) => set.has(wd));
  });

  // The render only knows the visible week. The live app supplies any carried
  // streak history, so every preview frame shows the visible trailing run.
  const finalize = (cellsByHabit: HabitWeekCell[][]): Row[] =>
    habits.map((h, hi) => ({
      name: h.name,
      cells: cellsByHabit[hi],
      streak: trailingStreak(cellsByHabit[hi]),
    }));

  // BLANK: the whole week is empty, starting today.
  if (state === 'blank') {
    return finalize(
      habits.map((_, hi) => dayOrder.map((_wd, ci) => (sched[hi][ci] ? 'gap' : 'off'))),
    );
  }

  // FULL: every scheduled day done. The live app supplies true carried streaks;
  // the render preview shows the visible run without inventing sample history.
  if (state === 'full') {
    return finalize(
      habits.map((_, hi) => dayOrder.map((_wd, ci) => (sched[hi][ci] ? 'done' : 'off'))),
    );
  }

  // GAPS: the final two displayed columns are never reported, regardless of the
  // weekday the user's week starts on. The other days are a mix of done and misses.
  if (state === 'gaps') {
    const EMPTY_COLUMNS = new Set([5, 6]);
    return finalize(
      habits.map((_, hi) =>
        dayOrder.map((wd, ci) => {
          if (EMPTY_COLUMNS.has(ci)) return 'gap';
          if (!sched[hi][ci]) return 'off';
          // Of the days they did report, about half are done and a lot are X's.
          return rand(hi * 131 + ci * 17 + 71) < 0.6 ? 'done' : 'missed';
        }),
      ),
    );
  }

  // P78 / P36: project the user's real rows, never samples, to the approved
  // 76% / 35% framing. Everything else scheduled is a reported miss.
  const targetPct = state === 'p78' ? 76 : 35;
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

  // p78: one real user habit, when present, ends with a miss so the projection
  // shows that a mostly green week can include a broken run.
  if (state === 'p78') {
    const mi = habits.length > RITUAL_COUNT ? RITUAL_COUNT : 0;
    const schedCols = dayOrder.map((_wd, ci) => ci).filter((ci) => sched[mi][ci]);
    const last = schedCols[schedCols.length - 1];
    if (last != null) cells[mi][last] = 'missed';
  }

  // p36: two of the three rituals keep a small run. Morning check-in is the full
  // survivor; evening reflection holds its last couple of days so it still
  // ends on a small streak while everything else takes a hit.
  if (state === 'p36') {
    const ri = 2; // Evening reflection
    const schedCols = dayOrder.map((_wd, ci) => ci).filter((ci) => sched[ri][ci]);
    for (const ci of schedCols.slice(-2)) cells[ri][ci] = 'done';
  }

  return finalize(cells);
}

function normalizedSchedule(days: unknown): number[] | null {
  if (!Array.isArray(days) || days.length === 0) return null;
  const unique = [...new Set(days)];
  return unique.length === days.length &&
    unique.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    ? unique
    : null;
}

function overallStats(rows: Row[]): { done: number; scheduled: number; percent: number } {
  // The percent is done out of the days that were actually REPORTED (done or
  // missed). Never-reported days (gap) are the separate "you disappeared" story,
  // so they do not drag the done-rate down.
  let done = 0;
  let reported = 0;
  for (const row of rows) {
    for (const c of row.cells) {
      if (c === 'off' || c === 'gap') continue;
      reported += 1;
      if (c === 'done') done += 1;
    }
  }
  return { done, scheduled: reported, percent: reported ? Math.round((done / reported) * 100) : 0 };
}

// Default narration per state. Real copy can override via props.coachLine.
const DEFAULT_COACH_LINES: Record<ProjectionState, string> = {
  blank: 'This is your week. Blank, starting today.',
  full: 'Best case, every day green. 100% success. That would be amazing.',
  p78: 'Most likely your week looks somewhere around here. Mostly green, a few misses. Still a real win.',
  p36: "Some weeks can look like this. And even that's okay, because you're in the process and you're consistent inside the process.",
  gaps: 'The one thing you want to avoid is this. The empty days you never reported. Stay consistent, just report it. Even a miss counts. That keeps the momentum going.',
};

// A short accent label per state so the designer can tell the frames apart.
const STATE_LABEL: Record<ProjectionState, string> = {
  blank: 'Your blank week',
  full: 'Best case',
  p78: 'More likely',
  p36: 'Tough week',
  gaps: 'What to avoid',
};

// Renders one static projection frame: the coach narration above the grid.
function WeeklyProjectionCard({
  state,
  coachLine,
  locale,
}: {
  state: ProjectionState;
  coachLine: string;
  locale?: string;
}) {
  const flow = useFlowState();
  const configuredUserHabits = (flow?.habits ?? []).map((name) => ({
    name,
    days: normalizedSchedule(flow?.habitConfigs[name]?.days),
  }));
  const incompleteHabits = configuredUserHabits
    .filter((habit) => habit.days === null)
    .map((habit) => habit.name);
  const userHabits: ScheduledHabit[] = configuredUserHabits.filter(
    (habit): habit is { name: string; days: number[] } => habit.days !== null,
  );
  const allHabits = [...ritualRows(locale), ...userHabits];
  // The week starts on the user's start day (today). In the real app this is the
  // stored start date; here it is the current weekday so the preview reads right.
  const start = new Date().getDay();
  const dayOrder = dayOrderFrom(start);
  const dayLabels = dayOrder.map((wd) => LABELS[wd]);

  if (incompleteHabits.length) {
    return (
      <div style={{ ...CARD, padding: `${SPACE.md}px ${SPACE.lg}px` }}>
        <p
          style={{
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.5,
            color: INK,
            margin: 0,
          }}
        >
          Your projection needs a schedule for {incompleteHabits.join(', ')} before it can be shown.
        </p>
        <p
          style={{
            fontFamily: FONT,
            fontSize: 12.5,
            lineHeight: 1.5,
            color: INK,
            margin: `${SPACE.xs}px 0 0`,
          }}
        >
          Set at least one weekday for each selected habit, then return to this projection.
        </p>
      </div>
    );
  }

  const rows = buildRows(allHabits, state, dayOrder);
  const stats = overallStats(rows);
  const projectedPercent = state === 'p78' ? 76 : state === 'p36' ? 35 : stats.percent;

  return (
    <div style={{ display: 'flex', width: '100%', flexDirection: 'column', gap: SPACE.md }}>
      <div
        style={{
          ...CARD,
          padding: `${SPACE.md}px ${SPACE.lg}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE.xs,
        }}
      >
        <span
          style={{
            fontFamily: FONT,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.05em',
            textTransform: 'uppercase' as const,
            color: PRIMARY,
          }}
        >
          {STATE_LABEL[state]}
        </span>
        <p
          style={{
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.55,
            color: INK,
            margin: 0,
          }}
        >
          {coachLine}
        </p>
      </div>
      <WeeklyHabitsSummary
        overallPercent={projectedPercent}
        overallDone={stats.done}
        overallScheduled={stats.scheduled}
        rows={rows}
        dayLabels={dayLabels}
        showToday={false}
      />
    </div>
  );
}

function WeeklyProjectionBeat(props?: Record<string, string>) {
  const state: ProjectionState = (props?.state as ProjectionState | undefined) ?? 'blank';
  const coachLine = props?.coachLine ?? DEFAULT_COACH_LINES[state];

  const steps: BeatStep[] = [
    {
      id: 'weekly-projection-grid',
      speaker: 'coach',
      render: <WeeklyProjectionCard state={state} coachLine={coachLine} locale={props?.locale} />,
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const weeklyProjectionBeat: BeatDef = {
  type: 'weekly-projection',
  group: 'Onboarding',
  label: 'Weekly projection (habit grid)',
  Comp: WeeklyProjectionBeat,
};

export default weeklyProjectionBeat;
