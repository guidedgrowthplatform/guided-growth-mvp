import { Icon } from '@iconify/react';
import { useState } from 'react';
import { LineChart } from '@/components/preview/MiniCharts';

// Calendar, detailed. The per-habit drill-down: pick a habit and see its own
// line chart (weekly completion across the month), the streak/best/rate stats,
// a by-weekday read, and a one-line coach reading of the shape. Reuses the
// token-styled LineChart. Mock.

interface HabitTrend {
  color: string;
  icon: string;
  weekly: number[]; // completion % per week
  streak: number;
  best: number;
  monthRate: number;
  delta: string;
  strongestDay: string;
  weakestDay: string;
  reading: string;
}

const HABITS: Record<string, HabitTrend> = {
  'Morning walk': {
    color: 'bg-emerald-400',
    icon: 'ph:person-simple-walk-bold',
    weekly: [60, 72, 80, 76, 92, 100],
    streak: 5,
    best: 9,
    monthRate: 82,
    delta: '+8%',
    strongestDay: 'Tuesdays',
    weakestDay: 'Sundays',
    reading: 'Climbing steadily. Tuesdays are your anchor, Sundays are where it dips.',
  },
  'Evening reset': {
    color: 'bg-primary',
    icon: 'ph:moon-stars-bold',
    weekly: [80, 62, 70, 54, 66, 72],
    streak: 2,
    best: 6,
    monthRate: 64,
    delta: '-4%',
    strongestDay: 'Mondays',
    weakestDay: 'Wednesdays',
    reading: 'Wobbly midweek. Wednesdays keep breaking the chain, everything else holds.',
  },
  Journal: {
    color: 'bg-violet-400',
    icon: 'ph:notebook-bold',
    weekly: [40, 52, 34, 48, 56, 62],
    streak: 1,
    best: 4,
    monthRate: 49,
    delta: '+3%',
    strongestDay: 'Fridays',
    weakestDay: 'Midweek',
    reading: 'Early days, but the trend is up. Fridays are becoming your journaling night.',
  },
};

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? 'text-primary' : 'text-content'}`}>
        {value}
      </p>
    </div>
  );
}

export function HabitTrendPreview({
  initialHabit,
  onBack,
}: {
  initialHabit?: string;
  onBack?: () => void;
} = {}) {
  const names = Object.keys(HABITS);
  const [active, setActive] = useState(
    initialHabit && HABITS[initialHabit] ? initialHabit : names[0],
  );
  const h = HABITS[active];

  return (
    <div className="min-h-dvh bg-primary-bg px-5 pb-12 pt-[max(2.5rem,env(safe-area-inset-top))]">
      {onBack && (
        <button
          type="button"
          aria-label="Back"
          onClick={onBack}
          className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary text-content"
        >
          <Icon icon="ic:round-chevron-left" width={22} />
        </button>
      )}
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Calendar detail</p>
      <h1 className="mt-1 text-[22px] font-semibold text-content">Habit trends</h1>
      <p className="mt-1 text-sm text-content-secondary">
        Tap a day on the calendar, or a habit here.
      </p>

      {/* Habit picker */}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {names.map((n) => {
          const on = n === active;
          return (
            <button
              key={n}
              type="button"
              onClick={() => setActive(n)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold transition-colors ${
                on
                  ? 'bg-primary text-white'
                  : 'border border-border-light bg-surface text-content-secondary'
              }`}
            >
              <span
                className={`h-3 w-3 rounded-full ${on ? 'bg-white/80' : h && HABITS[n].color}`}
              />
              {n}
            </button>
          );
        })}
      </div>

      {/* The per-habit line chart */}
      <div className="mt-4 rounded-3xl bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${h.color}`}>
            <Icon icon={h.icon} width={20} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-content">{active}</p>
            <p className="text-xs text-content-secondary">Completion by week, this month</p>
          </div>
          <span
            className={`text-sm font-bold ${
              h.delta.startsWith('-') ? 'text-content-tertiary' : 'text-emerald-600'
            }`}
          >
            {h.delta}
          </span>
        </div>
        <div className="mt-2">
          <LineChart
            data={h.weekly}
            labels={['W1', 'W2', 'W3', 'W4', 'W5', 'W6']}
            highlight={h.weekly.length - 1}
            formatValue={(v) => `${v}%`}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Stat label="Current streak" value={`${h.streak} days`} accent />
        <Stat label="Best streak" value={`${h.best} days`} />
        <Stat label="This month" value={`${h.monthRate}%`} />
        <Stat label="Strongest" value={h.strongestDay} />
      </div>

      {/* Coach reading of the shape -- ties the chart to care */}
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
        <Icon icon="ph:sparkle-fill" width={18} className="mt-0.5 shrink-0 text-primary" />
        <p className="text-sm leading-relaxed text-content">{h.reading}</p>
      </div>
    </div>
  );
}
