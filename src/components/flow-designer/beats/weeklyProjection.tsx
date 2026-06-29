/**
 * weeklyProjection, flow-builder beat for the weekly habit grid projection.
 *
 * Faithful port of the skimmer component (ggmvp-skimmer
 * src/onboarding-flow/WeeklyProjection.tsx): same coach rituals, same sample
 * habits, same modes (blank, full, p78, p36, gaps), same percentages, same gap
 * logic, same narration lines. The flow builder splits the skimmer's
 * auto-cycling stages into five separate beats (one per state) via props.state.
 *
 * Props (both editable in the sidebar):
 *   state     - which projection frame (blank | full | p78 | p36 | gaps)
 *   coachLine - the narration shown above the grid (skimmer line by default)
 *
 * RULES followed here:
 *   - No em dashes anywhere (commas and periods used instead)
 *   - Coach narration never says tap, scroll, click, or press
 *   - Real WeeklyHabitsSummary component reused via the @/components alias
 *   - Streak counts derived directly from the cell arrays so they always match
 */
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { WeeklyHabitsSummary, type HabitWeekCell } from '@/components/habit-detail/WeeklyHabitsSummary';
import { FONT, PRIMARY, INK, CARD, SPACE } from './_beatStyle';

// The five projection states, matching the skimmer modes exactly.
export type ProjectionState = 'blank' | 'full' | 'p78' | 'p36' | 'gaps';

interface ScheduledHabit {
  name: string;
  days: number[]; // JS weekday numbers, 0=Sun..6=Sat
}

// Three rituals every user gets, all daily. Same as the skimmer COACH_HABITS.
const COACH_HABITS: ScheduledHabit[] = [
  { name: 'Morning state check-in', days: [0, 1, 2, 3, 4, 5, 6] },
  { name: 'Evening habit report', days: [0, 1, 2, 3, 4, 5, 6] },
  { name: 'Daily reflection', days: [0, 1, 2, 3, 4, 5, 6] },
];

// Sample captured habits, matching the skimmer demo so the rendered week is
// identical. Real flows pass the habits the user just captured.
const SAMPLE_USER_HABITS: ScheduledHabit[] = [
  { name: 'Meditate', days: [0, 1, 2, 3, 4, 5, 6] },
  { name: 'Workout', days: [1, 3, 5] },
  { name: 'Read 10 pages', days: [0, 1, 2, 3, 4, 5, 6] },
  { name: 'No phone in bed', days: [0, 1, 2, 3, 4, 5, 6] },
  { name: 'Journal', days: [1, 2, 3, 4, 5] },
];

// WeeklyHabitsSummary renders Mon-first (M T W T F S S). DAY_ORDER maps column
// index 0..6 to JS weekday: Mon=1, ..., Sat=6, Sun=0.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// Heroes stay fully green so at least one streak survives (indices into the
// combined list: 0,1,2 are the coach rituals).
const HEROES: Partial<Record<ProjectionState, number[]>> = {
  p78: [0, 1],
  p36: [0],
};

const TARGET_PCT: Partial<Record<ProjectionState, number>> = {
  p78: 78,
  p36: 36,
};

const SALT: Record<ProjectionState, number> = { blank: 1, full: 2, p78: 20, p36: 34, gaps: 50 };

interface Row {
  name: string;
  cells: HabitWeekCell[];
  streak: number;
}

// Tiny deterministic PRNG ported from the skimmer so projected weeks are stable
// across re-renders but look organic per habit/day pair.
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

// Build row data for a given projection state, matching the skimmer exactly.
function buildRows(habits: ScheduledHabit[], state: ProjectionState): Row[] {
  const scheduled = habits.map((h) => {
    const days = h.days && h.days.length ? h.days : [0, 1, 2, 3, 4, 5, 6];
    const set = new Set(days);
    return DAY_ORDER.map((weekday) => set.has(weekday));
  });

  // blank / full / gaps: decided per cell.
  if (state === 'blank' || state === 'full' || state === 'gaps') {
    return habits.map((h, hi) => {
      const cells: HabitWeekCell[] = DAY_ORDER.map((_, ci) => {
        if (!scheduled[hi][ci]) return 'off';
        if (state === 'blank') return 'gap';
        if (state === 'full') return 'done';
        const r = rand(hi * 131 + ci * 17 + SALT.gaps);
        if (r < 0.26) return 'gap';
        if (r < 0.62) return 'missed';
        return 'done';
      });
      return { name: h.name, cells, streak: trailingStreak(cells) };
    });
  }

  // p78 / p36: hit the named percent exactly. Heroes stay fully green (the
  // surviving streak); the remaining done days scatter across the other habits.
  const heroes = HEROES[state] ?? [];
  const targetPct = TARGET_PCT[state] ?? 0;
  let totalScheduled = 0;
  let heroDone = 0;
  const pool: { hi: number; ci: number; pri: number }[] = [];
  habits.forEach((_, hi) => {
    scheduled[hi].forEach((sched, ci) => {
      if (!sched) return;
      totalScheduled += 1;
      if (heroes.includes(hi)) heroDone += 1;
      else pool.push({ hi, ci, pri: rand(hi * 131 + ci * 17 + SALT[state]) });
    });
  });
  const targetDone = Math.round((targetPct / 100) * totalScheduled);
  const fromPool = Math.max(0, Math.min(targetDone - heroDone, pool.length));
  pool.sort((a, b) => a.pri - b.pri);
  const doneCells = new Set(pool.slice(0, fromPool).map((c) => `${c.hi}:${c.ci}`));

  return habits.map((h, hi) => {
    const cells: HabitWeekCell[] = DAY_ORDER.map((_, ci) => {
      if (!scheduled[hi][ci]) return 'off';
      if (heroes.includes(hi)) return 'done';
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
  return { done, scheduled, percent: scheduled ? Math.round((done / scheduled) * 100) : 0 };
}

// Default narration per state: the skimmer's exact lines. Real copy can override
// via props.coachLine.
const DEFAULT_COACH_LINES: Record<ProjectionState, string> = {
  blank: 'This is your week. Blank, starting today.',
  full: 'Best case, every day green. Every streak going strong. That would be amazing.',
  p78: "More likely, you land around here. Mostly green, a few misses, your streaks holding. That's a real win.",
  p36: "Some weeks land here. One streak survives, the rest take a hit. Still fine, you're building. We reassess.",
  gaps: 'The one thing we want to avoid is this. The empty days you never reported. Stay consistent, just report it. Even a miss counts, that keeps us going.',
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
function WeeklyProjectionCard({ state, coachLine }: { state: ProjectionState; coachLine: string }) {
  const allHabits = [...COACH_HABITS, ...SAMPLE_USER_HABITS];
  const rows = buildRows(allHabits, state);
  const stats = overallStats(rows);

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
        <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: 1.55, color: INK, margin: 0 }}>
          {coachLine}
        </p>
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

function WeeklyProjectionBeat(props?: Record<string, string>) {
  const state: ProjectionState = (props?.state as ProjectionState | undefined) ?? 'blank';
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

const weeklyProjectionBeat: BeatDef = {
  type: 'weekly-projection',
  group: 'Onboarding',
  label: 'Weekly projection (habit grid)',
  Comp: WeeklyProjectionBeat,
};

export default weeklyProjectionBeat;
