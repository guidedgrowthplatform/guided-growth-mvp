/**
 * weeklyProjection, flow-builder beat for the weekly habit grid projection.
 *
 * One BeatDef, type 'weekly-projection'. The flow organiser adds five
 * DEFAULT_FLOW entries (one per state), each passing different props.state and
 * props.coachLine values so the designer can see each frame in sequence.
 *
 * Props (both editable in the sidebar):
 *   state     - which projection frame to show (see ProjectionState)
 *   coachLine - the narration text shown above the grid (placeholder by default;
 *               real copy comes from the beats-context lane)
 *
 * States:
 *   empty - blank starting week, nothing reported yet
 *   full  - 100% green, every streak strong
 *   p74   - 74% done, mostly green, a few misses, streaks holding
 *   p30   - 30% done, one streak survives, the rest took a hit
 *   gaps  - the one to avoid: exactly two habit rows have unreported days (gap
 *           cells), the rest are green or off, to show what empty days look like
 *
 * Coach rituals (Morning state check-in, Evening habit report, Daily reflection)
 * appear at the top of every frame, the same way the skimmer does.
 *
 * RULES followed here:
 *   - No em dashes anywhere (commas and periods used instead)
 *   - Coach narration never says tap, scroll, click, or press
 *   - Real WeeklyHabitsSummary component reused via the @/components alias
 *   - Streak counts derived directly from the cell arrays so they always match
 */
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { WeeklyHabitsSummary, type HabitWeekCell } from '@/components/habit-detail/WeeklyHabitsSummary';

// The five projection states. Passed via props.state so the flow organiser can
// configure each DEFAULT_FLOW entry independently.
export type ProjectionState = 'empty' | 'full' | 'p74' | 'p30' | 'gaps';

interface ScheduledHabit {
  name: string;
  days: number[]; // JS weekday numbers, 0=Sun..6=Sat
}

// Three coach-owned rituals shown in every frame, matching the skimmer's
// COACH_HABITS constant. All daily.
const COACH_HABITS: ScheduledHabit[] = [
  { name: 'Morning state check-in', days: [0, 1, 2, 3, 4, 5, 6] },
  { name: 'Evening habit report',   days: [0, 1, 2, 3, 4, 5, 6] },
  { name: 'Daily reflection',       days: [0, 1, 2, 3, 4, 5, 6] },
];

// Sample user habits. Real flows pass in the habits the user just captured;
// these placeholders give the beat a realistic look in the designer.
const SAMPLE_USER_HABITS: ScheduledHabit[] = [
  { name: 'Morning walk',          days: [1, 2, 3, 4, 5] },      // Mon to Fri
  { name: 'No screens after 10 PM', days: [0, 1, 2, 3, 4, 5, 6] },
  { name: 'Read 10 pages',          days: [0, 1, 2, 3, 4, 5, 6] },
];

// WeeklyHabitsSummary renders Mon-first (M T W T F S S). DAY_ORDER maps
// column index 0..6 to JS weekday: Mon=1, Tue=2, ..., Sat=6, Sun=0.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// Tiny deterministic PRNG ported from the skimmer so projected weeks are
// stable across re-renders but look organic per habit/day pair.
function rand(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Trailing streak: consecutive 'done' cells from the end, skipping 'off'.
function trailingStreak(cells: HabitWeekCell[]): number {
  let s = 0;
  for (let ci = 6; ci >= 0; ci--) {
    const c = cells[ci];
    if (c === 'off') continue;
    if (c === 'done') s += 1;
    else break;
  }
  return s;
}

// Per-state PRNG salts keep p74 and p30 visually distinct.
const SALT: Record<ProjectionState, number> = {
  empty: 1,
  full:  2,
  p74:   20,
  p30:   34,
  gaps:  50,
};

interface Row {
  name: string;
  cells: HabitWeekCell[];
  streak: number;
}

// Build row data for a given projection state.
function buildRows(habits: ScheduledHabit[], state: ProjectionState): Row[] {
  const scheduled = habits.map((h) => {
    const set = new Set(h.days);
    return DAY_ORDER.map((weekday) => set.has(weekday));
  });

  // empty: everything scheduled shows as gap (never reported).
  if (state === 'empty') {
    return habits.map((h, hi) => {
      const cells: HabitWeekCell[] = DAY_ORDER.map((_, ci) =>
        scheduled[hi][ci] ? 'gap' : 'off',
      );
      return { name: h.name, cells, streak: 0 };
    });
  }

  // full: every scheduled day is done.
  if (state === 'full') {
    return habits.map((h, hi) => {
      const cells: HabitWeekCell[] = DAY_ORDER.map((_, ci) =>
        scheduled[hi][ci] ? 'done' : 'off',
      );
      return { name: h.name, cells, streak: trailingStreak(cells) };
    });
  }

  // gaps: EXACTLY TWO habits show gap cells. We pick the first two user habits
  // (indices >= COACH_HABITS.length) so the coach rituals stay green, making
  // the contrast between "green rituals" and "empty user habits" read clearly.
  // Fallback to the first two rows overall if there are fewer than two user habits.
  if (state === 'gaps') {
    const gapRows = new Set<number>();
    for (let hi = COACH_HABITS.length; hi < habits.length && gapRows.size < 2; hi++) {
      gapRows.add(hi);
    }
    for (let hi = 0; hi < habits.length && gapRows.size < 2; hi++) {
      gapRows.add(hi);
    }

    return habits.map((h, hi) => {
      const cells: HabitWeekCell[] = DAY_ORDER.map((_, ci) => {
        if (!scheduled[hi][ci]) return 'off';
        return gapRows.has(hi) ? 'gap' : 'done';
      });
      return { name: h.name, cells, streak: trailingStreak(cells) };
    });
  }

  // p74 and p30: hit the named percentage exactly via a seeded sort.
  // Hero rows stay fully green so at least one streak survives per state.
  const targetPct = state === 'p74' ? 74 : 30;
  // p74: first two coach rows are heroes (morning + evening streaks hold).
  // p30: first coach row only (morning streak alone survives).
  const heroRows = state === 'p74' ? new Set([0, 1]) : new Set([0]);

  let totalScheduled = 0;
  let heroDone = 0;
  const pool: { hi: number; ci: number; pri: number }[] = [];

  habits.forEach((_, hi) => {
    scheduled[hi].forEach((sched, ci) => {
      if (!sched) return;
      totalScheduled += 1;
      if (heroRows.has(hi)) {
        heroDone += 1;
      } else {
        pool.push({ hi, ci, pri: rand(hi * 131 + ci * 17 + SALT[state]) });
      }
    });
  });

  const targetDone = Math.round((targetPct / 100) * totalScheduled);
  const fromPool = Math.max(0, Math.min(targetDone - heroDone, pool.length));
  pool.sort((a, b) => a.pri - b.pri);
  const doneCells = new Set(pool.slice(0, fromPool).map((c) => `${c.hi}:${c.ci}`));

  return habits.map((h, hi) => {
    const cells: HabitWeekCell[] = DAY_ORDER.map((_, ci) => {
      if (!scheduled[hi][ci]) return 'off';
      if (heroRows.has(hi)) return 'done';
      return doneCells.has(`${hi}:${ci}`) ? 'done' : 'missed';
    });
    return { name: h.name, cells, streak: trailingStreak(cells) };
  });
}

function overallStats(rows: Row[]): { done: number; scheduled: number; percent: number } {
  let done = 0;
  let scheduled = 0;
  for (const row of rows) {
    for (const c of row.cells) {
      if (c === 'off') continue;
      scheduled += 1;
      if (c === 'done') done += 1;
    }
  }
  return {
    done,
    scheduled,
    percent: scheduled ? Math.round((done / scheduled) * 100) : 0,
  };
}

// Default placeholder narration for each state. Real copy comes from the
// beats-context lane and is supplied via props.coachLine.
const DEFAULT_COACH_LINES: Record<ProjectionState, string> = {
  empty:
    'This is your week. Blank, starting today.',
  full:
    'Best case, every day green. Every streak going strong. That would be amazing.',
  p74:
    'More likely you land around here. Mostly green, a few misses, your streaks holding. That is a real win.',
  p30:
    'Some weeks land here. One streak survives, the rest take a hit. Still fine, you are building. We reassess.',
  gaps:
    'The one thing to avoid: these empty days you never reported. Stay consistent, just report it. Even a miss counts, that keeps us going.',
};

// Renders one static projection frame: the coach narration above the grid.
function WeeklyProjectionCard({
  state,
  coachLine,
}: {
  state: ProjectionState;
  coachLine: string;
}) {
  const allHabits = [...COACH_HABITS, ...SAMPLE_USER_HABITS];
  const rows = buildRows(allHabits, state);
  const stats = overallStats(rows);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="rounded-xl bg-surface-secondary px-4 py-3">
        <p className="text-sm leading-relaxed text-content">{coachLine}</p>
      </div>
      <WeeklyHabitsSummary
        overallPercent={stats.percent}
        overallDone={stats.done}
        overallScheduled={stats.scheduled}
        rows={rows}
      />
    </div>
  );
}

// The beat component. Reads state and coachLine from props so the flow
// organiser can configure each DEFAULT_FLOW entry independently. Falls back to
// 'empty' and the placeholder line if props are absent (static canvas preview).
function WeeklyProjectionBeat(props?: Record<string, string>) {
  const state: ProjectionState =
    (props?.state as ProjectionState | undefined) ?? 'empty';
  const coachLine = props?.coachLine ?? DEFAULT_COACH_LINES[state];

  const steps: BeatStep[] = [
    {
      id: 'weekly-projection-grid',
      speaker: 'coach',
      render: <WeeklyProjectionCard state={state} coachLine={coachLine} />,
    },
  ];

  return <BeatPlayer steps={steps} />;
}

// One BeatDef covers all five states via props. The flow organiser adds five
// DEFAULT_FLOW entries of type 'weekly-projection', each with a different
// props.state ('empty' | 'full' | 'p74' | 'p30' | 'gaps') and props.coachLine.
const weeklyProjectionBeat: BeatDef = {
  type: 'weekly-projection',
  group: 'Onboarding',
  label: 'Weekly projection (habit grid)',
  Comp: WeeklyProjectionBeat,
};

export default weeklyProjectionBeat;
