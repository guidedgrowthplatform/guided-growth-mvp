import { Icon } from '@iconify/react';
import { HabitProgressRing } from '@/components/insights/HabitProgressRing';
import { LineChart, Sparkline } from '@/components/preview/MiniCharts';

// Weekly Coach, upgraded. The content that makes a user feel seen: their week
// made visible (day rings), a trend that EXPLAINS (consistency line + a
// projection), the dimensions the coach is watching for them, per-habit progress
// with sparklines, and a personal reading with one small next step. Reuses the
// app's HabitProgressRing. Chart primitives are token-styled SVG. Mock.

const DAY_RINGS = [
  { d: 'M', pct: 100 },
  { d: 'T', pct: 100 },
  { d: 'W', pct: 60 },
  { d: 'T', pct: 100 },
  { d: 'F', pct: 80 },
  { d: 'S', pct: 40 },
  { d: 'S', pct: 0 },
];

const WATCHING = [
  {
    icon: 'ph:target-bold',
    label: 'Consistency',
    value: '78%',
    delta: '+6 this week',
    tint: 'text-primary',
  },
  {
    icon: 'ph:smiley-bold',
    label: 'Mood',
    value: 'Lifting',
    delta: 'up 3 days',
    tint: 'text-emerald-500',
  },
  {
    icon: 'ph:battery-charging-bold',
    label: 'Energy',
    value: 'Steady',
    delta: 'holding',
    tint: 'text-amber-500',
  },
];

const PROGRESS = [
  {
    name: 'Morning walk',
    sub: '5-day streak',
    data: [1, 1, 1, 0, 1, 1, 1],
    color: 'text-emerald-500',
    trend: '+2',
  },
  {
    name: 'Evening reset',
    sub: 'Slips midweek',
    data: [1, 1, 0, 1, 0, 1, 1],
    color: 'text-primary',
    trend: '0',
  },
  {
    name: 'Journal',
    sub: 'Twice this week',
    data: [1, 0, 0, 1, 0, 0, 1],
    color: 'text-violet-500',
    trend: '-1',
  },
];

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-surface p-5 shadow-card ${className}`}>{children}</div>;
}

export function WeeklyCoachDetailPreview() {
  return (
    <div className="min-h-dvh bg-primary-bg px-5 pb-12 pt-[max(2.5rem,env(safe-area-inset-top))]">
      {/* Coach greeting -- specific, warm, feels seen */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Icon icon="ph:sparkle-fill" width={20} className="text-primary" />
        </div>
        <div>
          <p className="text-[22px] font-semibold leading-tight text-content">Your week, seen</p>
          <p className="mt-1 text-sm text-content-secondary">
            I have been watching. Here is what I notice, and one thing for next week.
          </p>
        </div>
      </div>

      {/* Day rings */}
      <div className="mt-6 flex justify-between">
        {DAY_RINGS.map((r, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <HabitProgressRing percentage={r.pct} size={38} strokeWidth={3} />
            <span className="text-[11px] font-bold text-content-tertiary">{r.d}</span>
          </div>
        ))}
      </div>

      {/* The trend that explains */}
      <Card className="mt-6">
        <div className="mb-1 flex items-baseline justify-between">
          <p className="text-sm font-bold text-content">Your consistency</p>
          <span className="text-xs font-semibold text-emerald-600">on track</span>
        </div>
        <p className="text-xs text-content-secondary">
          Five weeks in. Keep this and you reach a full month next week.
        </p>
        <div className="mt-2">
          <LineChart
            data={[52, 61, 58, 72, 78, 88]}
            labels={['W1', 'W2', 'W3', 'W4', 'Now', 'W6']}
            highlight={4}
            solidCount={5}
            formatValue={(v) => `${v}%`}
          />
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-content-tertiary">
          <span className="inline-block h-2 w-4 rounded-full border-b-2 border-dashed border-primary" />
          Dashed is where you land if this week holds
        </p>
      </Card>

      {/* What the coach is watching FOR you */}
      <p className="mt-7 text-sm font-bold text-content">What I am watching for you</p>
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {WATCHING.map((w) => (
          <div key={w.label} className="rounded-2xl bg-surface p-3 shadow-sm">
            <Icon icon={w.icon} width={22} className={w.tint} />
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-content-tertiary">
              {w.label}
            </p>
            <p className="text-base font-bold text-content">{w.value}</p>
            <p className="text-[11px] text-content-secondary">{w.delta}</p>
          </div>
        ))}
      </div>

      {/* Per-habit progress with sparklines */}
      <p className="mt-7 text-sm font-bold text-content">Every habit</p>
      <div className="mt-3 flex flex-col gap-2.5">
        {PROGRESS.map((p) => (
          <div
            key={p.name}
            className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-content">{p.name}</p>
              <p className="truncate text-xs text-content-secondary">{p.sub}</p>
            </div>
            <Sparkline data={p.data.map((v, i) => v + i * 0.15)} className={p.color} />
            <span
              className={`w-6 text-right text-xs font-bold ${
                p.trend.startsWith('-') ? 'text-content-tertiary' : 'text-emerald-600'
              }`}
            >
              {p.trend}
            </span>
          </div>
        ))}
      </div>

      {/* Personal reading + one small next step */}
      <Card className="mt-7 border border-primary/15 bg-primary/5">
        <div className="flex items-center gap-2">
          <Icon icon="ph:hand-heart-bold" width={20} className="text-primary" />
          <p className="text-sm font-bold text-content">One thing for next week</p>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-content">
          Your mornings are becoming automatic, that is real. The evening reset is the one that
          slips on Wednesdays. Let us protect just Wednesday night. Small, and it lifts the whole
          week.
        </p>
      </Card>

      <button
        type="button"
        className="mt-4 w-full rounded-full bg-primary py-3.5 text-base font-bold text-white"
      >
        Protect Wednesday evening
      </button>
    </div>
  );
}
