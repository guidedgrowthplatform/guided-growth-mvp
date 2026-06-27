/**
 * WeeklyProjection — the post-capture expectation-setting beat.
 *
 * Shows the REAL weekly habit grid (WeeklyHabitsSummary), seeded with the
 * habits + days the user just set (plus the three coach rituals), then animates
 * FIVE projected weeks in order:
 *   1. blank   — nothing reported yet (0%)
 *   2. full    — every day green, every streak strong (100%)
 *   3. p78     — mostly green, a few misses, streaks holding (~78%)
 *   4. p36     — one streak survives, the rest take a hit, still building (~36%)
 *   5. gaps    — the one to avoid: days never reported at all (gray gaps)
 * States 2 to 4 are fully reported (no gaps). Only the last shows gaps. Coach
 * narration frames reporting itself as the win and weekly reassessment as the
 * loop.
 *
 * Subtitle-first: the narration renders on-screen. The MP3 (Cartesia, Yair Pro
 * Clone voice) timed to these stages is a follow-up once the timing is locked.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { WeeklyHabitsSummary, type HabitWeekCell } from '@/components/habit-detail/WeeklyHabitsSummary';

export interface ProjectionHabit {
  name: string;
  days?: number[]; // 0=Sun..6=Sat
  polarity?: 'positive' | 'negative' | null;
}

// Three rituals the app gives every user. They show in the week alongside the
// habits the user captured. All daily, all "build".
const COACH_HABITS: ProjectionHabit[] = [
  { name: 'Morning check-in', days: [0, 1, 2, 3, 4, 5, 6], polarity: 'positive' },
  { name: 'Evening habit report', days: [0, 1, 2, 3, 4, 5, 6], polarity: 'positive' },
  { name: 'Daily reflection', days: [0, 1, 2, 3, 4, 5, 6], polarity: 'positive' },
];

type Mode = 'blank' | 'full' | 'p78' | 'p36' | 'gaps';

// WeeklyHabitsSummary default labels are Monday-first: M T W T F S S.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// In the partial weeks, these habit rows stay fully green so at least one streak
// survives (by index in the combined list: 0,1,2 are the coach rituals).
const HEROES: Partial<Record<Mode, number[]>> = {
  p78: [0, 1],
  p36: [0],
};

const TARGET_PCT: Partial<Record<Mode, number>> = {
  p78: 78,
  p36: 36,
};

const SALT: Record<Mode, number> = { blank: 1, full: 2, p78: 20, p36: 34, gaps: 50 };

interface Row {
  name: string;
  cells: HabitWeekCell[];
  streak: number;
}

// Tiny deterministic PRNG so a projected week is stable across the loop (no
// flicker) yet looks organic per habit/day.
function rand(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Current streak: consecutive 'done' counting back from the end of the week,
// skipping days the habit is not scheduled.
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

function buildRows(habits: ProjectionHabit[], mode: Mode): Row[] {
  // scheduled[hi][ci] = is the habit scheduled on that weekday column
  const scheduled = habits.map((h) => {
    const days = h.days && h.days.length ? h.days : [0, 1, 2, 3, 4, 5, 6];
    const set = new Set(days);
    return DAY_ORDER.map((weekday) => set.has(weekday));
  });

  // blank / full / gaps: decided per cell
  if (mode === 'blank' || mode === 'full' || mode === 'gaps') {
    return habits.map((h, hi) => {
      const cells: HabitWeekCell[] = DAY_ORDER.map((_, ci) => {
        if (!scheduled[hi][ci]) return 'off';
        if (mode === 'blank') return 'gap';
        if (mode === 'full') return 'done';
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
  const heroes = HEROES[mode] ?? [];
  const targetPct = TARGET_PCT[mode] ?? 0;
  let totalScheduled = 0;
  let heroDone = 0;
  const pool: { hi: number; ci: number; pri: number }[] = [];
  habits.forEach((_, hi) => {
    scheduled[hi].forEach((sched, ci) => {
      if (!sched) return;
      totalScheduled += 1;
      if (heroes.includes(hi)) heroDone += 1;
      else pool.push({ hi, ci, pri: rand(hi * 131 + ci * 17 + SALT[mode]) });
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

function overall(rows: Row[]): { done: number; scheduled: number; percent: number } {
  let done = 0;
  let scheduled = 0;
  for (const row of rows) {
    for (const c of row.cells) {
      if (c === 'off') continue;
      scheduled += 1;
      if (c === 'done') done += 1;
    }
  }
  const percent = scheduled ? Math.round((done / scheduled) * 100) : 0;
  return { done, scheduled, percent };
}

interface Stage {
  mode: Mode;
  line: string;
  dur: number; // ms; 0 = final, hold here
}

const STAGES: Stage[] = [
  { mode: 'blank', dur: 3200, line: 'This is your week. Blank, starting today.' },
  {
    mode: 'full',
    dur: 3800,
    line: 'Best case, every day green. Every streak going strong. That would be amazing.',
  },
  {
    mode: 'p78',
    dur: 4200,
    line: "More likely, you land around here. Mostly green, a few misses, your streaks holding. That's a real win.",
  },
  {
    mode: 'p36',
    dur: 4200,
    line: "Some weeks land here. One streak survives, the rest take a hit. Still fine, you're building. We reassess.",
  },
  {
    mode: 'gaps',
    dur: 0,
    line: 'The one thing we want to avoid is this. The empty days you never reported. Stay consistent, just report it. Even a miss counts, that keeps us going.',
  },
];

export function WeeklyProjection({
  habits,
  onBack,
  includeCoachHabits = true,
}: {
  habits: ProjectionHabit[];
  onBack?: () => void;
  includeCoachHabits?: boolean;
}) {
  const allHabits = useMemo(
    () => (includeCoachHabits ? [...COACH_HABITS, ...habits] : habits),
    [habits, includeCoachHabits],
  );
  const rowsByMode = useMemo(
    () => ({
      blank: buildRows(allHabits, 'blank'),
      full: buildRows(allHabits, 'full'),
      p78: buildRows(allHabits, 'p78'),
      p36: buildRows(allHabits, 'p36'),
      gaps: buildRows(allHabits, 'gaps'),
    }),
    [allHabits],
  );

  const [stage, setStage] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const s = STAGES[stage];
    if (s.dur > 0) {
      timer.current = setTimeout(
        () => setStage((i) => Math.min(i + 1, STAGES.length - 1)),
        s.dur,
      );
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [stage]);

  const current = STAGES[stage];
  const rows = rowsByMode[current.mode];
  const stats = overall(rows);
  const atEnd = stage === STAGES.length - 1;

  return (
    <div style={{ maxHeight: '64vh', overflowY: 'auto', paddingBottom: 4 }}>
      <WeeklyHabitsSummary
        overallPercent={stats.percent}
        overallDone={stats.done}
        overallScheduled={stats.scheduled}
        rows={rows}
      />

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface-secondary p-3">
        <span className="mt-[1px] flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <Sparkles size={13} />
        </span>
        <p className="text-sm leading-relaxed text-content">{current.line}</p>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        {STAGES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setStage(i)}
            aria-label={`Stage ${i + 1}`}
            className={`h-2 w-2 rounded-full transition-colors ${
              i === stage ? 'bg-primary' : 'bg-border'
            }`}
          />
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setStage(0)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-content"
        >
          <RotateCcw size={14} />
          Replay
        </button>
        {atEnd ? (
          <button
            type="button"
            className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            Start my week
          </button>
        ) : (
          onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex-1 rounded-xl border border-border px-4 py-2 text-sm font-medium text-content"
            >
              Edit habits
            </button>
          )
        )}
      </div>
    </div>
  );
}
