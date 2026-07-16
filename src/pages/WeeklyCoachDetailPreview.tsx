import { Icon } from '@iconify/react';
import { useState } from 'react';
import { HabitProgressRing } from '@/components/insights/HabitProgressRing';
import { LineChart, Sparkline } from '@/components/preview/MiniCharts';

// Weekly Coach, upgraded. The content that makes a user feel seen: their week
// read ALOUD by the coach (with a voice toggle you control on the page), the week
// made visible (day rings), a trend that EXPLAINS, the dimensions the coach is
// watching, per-habit progress, and then the part that makes it feel like care:
// the coach turns this week's result into a concrete plan, telling the user what
// to keep, level up, adjust, or rest, and compiling it into next week's list.
// Reuses the app's HabitProgressRing. Chart primitives are token-styled SVG. Mock.

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

// The coach's read on each habit, tied to the numbers above: what performed, and
// what to do about it next week. This is the "care" layer, keep / level up /
// adjust / rest, not just a chart.
const PLAN = [
  {
    name: 'Morning walk',
    verdict: 'Level up',
    kind: 'add' as const,
    why: 'A 5-day streak. It is basically automatic now, so there is room to build on it.',
    action: 'Add a 5-minute stretch right after it',
  },
  {
    name: 'Evening reset',
    verdict: 'Adjust',
    kind: 'adjust' as const,
    why: 'It holds every day except Wednesday, when the day runs long.',
    action: 'Move it 30 minutes earlier on Wednesdays',
  },
  {
    name: 'Journal',
    verdict: 'Rest it',
    kind: 'remove' as const,
    why: 'Twice this week and trending down. It is fighting you right now.',
    action: 'Shrink it to one line, or pause it for a week',
  },
];

const KIND_STYLE: Record<
  'add' | 'adjust' | 'remove',
  { chip: string; icon: string; accent: string }
> = {
  add: {
    chip: 'bg-emerald-50 text-emerald-600',
    icon: 'ph:plus-circle-bold',
    accent: 'text-emerald-500',
  },
  adjust: {
    chip: 'bg-primary/10 text-primary',
    icon: 'ph:sliders-horizontal-bold',
    accent: 'text-primary',
  },
  remove: { chip: 'bg-amber-50 text-amber-600', icon: 'ph:moon-bold', accent: 'text-amber-500' },
};

// Next week's list, compiled from the plan above so the review ends in something
// the user can actually do, and check off.
const TODO = [
  'Keep the morning walk, it is automatic now',
  'Add a 5-minute stretch after the walk',
  'Move the evening reset 30 minutes earlier on Wednesdays',
  'Shrink journaling to a single line',
];

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-surface p-5 shadow-card ${className}`}>{children}</div>;
}

// The coach reading the week aloud. Voice is a real element on the page, and the
// user can mute it right here while they stay and read, exactly as asked.
function VoiceRecapBar() {
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(true);
  const active = playing && !muted;

  return (
    <div
      className="mt-5 flex items-center gap-3 rounded-3xl p-4 text-white"
      style={{ background: 'linear-gradient(135deg,#2f6bff,#5b8cff)' }}
    >
      <style>{`@keyframes wkeq{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}`}</style>
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        disabled={muted}
        aria-label={playing ? 'Pause' : 'Play'}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 disabled:opacity-40"
      >
        <Icon icon={active ? 'ph:pause-fill' : 'ph:play-fill'} width={22} />
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Your coach is reading your week</p>
        <div className="mt-1 flex items-center gap-2">
          {active ? (
            <span className="flex h-3.5 items-end gap-[3px]" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-white/90"
                  style={{
                    height: '100%',
                    animation: `wkeq 0.9s ease-in-out ${i * 0.12}s infinite`,
                  }}
                />
              ))}
            </span>
          ) : null}
          <p className="text-xs text-white/80">
            {muted
              ? 'Voice off. Read it below instead.'
              : active
                ? 'Speaking, about 40 seconds'
                : 'Paused'}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? 'Turn voice on' : 'Turn voice off'}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15"
      >
        <Icon
          icon={muted ? 'ph:speaker-simple-slash-bold' : 'ph:speaker-simple-high-bold'}
          width={20}
        />
      </button>
    </div>
  );
}

export function WeeklyCoachDetailPreview({
  onHabitSelect,
}: {
  onHabitSelect?: (habit: string) => void;
} = {}) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const toggleDone = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

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

      {/* The coach reads it aloud, with a voice toggle you control on the page */}
      <VoiceRecapBar />

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
          <button
            key={p.name}
            type="button"
            onClick={() => onHabitSelect?.(p.name)}
            className="flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left shadow-sm transition-shadow active:shadow-card-hover"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-content">{p.name}</p>
              <p className="truncate text-xs text-content-secondary">{p.sub}</p>
            </div>
            <Sparkline data={p.data.map((v, i) => v + i * 0.15)} className={p.color} />
            <Icon
              icon="ic:round-chevron-right"
              width={18}
              className="shrink-0 text-content-tertiary"
            />
          </button>
        ))}
      </div>

      {/* Personal reading + the headline next step */}
      <Card className="mt-7 border border-primary/15 bg-primary/5">
        <div className="flex items-center gap-2">
          <Icon icon="ph:hand-heart-bold" width={20} className="text-primary" />
          <p className="text-sm font-bold text-content">One thing for next week</p>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-content">
          Your mornings are becoming automatic, that is real. The evening reset is the one that
          slips on Wednesdays. Let us protect just Wednesday evening. Small, and it lifts the whole
          week.
        </p>
      </Card>

      {/* The care layer: turn this week's result into a plan, habit by habit */}
      <p className="mt-7 text-sm font-bold text-content">Turn this week into next week</p>
      <p className="mt-1 text-xs text-content-secondary">
        Based on how each one went, here is what I would keep, grow, or ease off.
      </p>
      <div className="mt-3 flex flex-col gap-2.5">
        {PLAN.map((p) => {
          const s = KIND_STYLE[p.kind];
          return (
            <div key={p.name} className="rounded-2xl bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Icon icon={s.icon} width={20} className={s.accent} />
                <p className="flex-1 text-sm font-bold text-content">{p.name}</p>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${s.chip}`}>
                  {p.verdict}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-content-secondary">{p.why}</p>
              <div className="mt-2 flex items-start gap-2 rounded-xl bg-primary-bg p-3">
                <Icon
                  icon="ph:arrow-bend-down-right-bold"
                  width={16}
                  className={`mt-0.5 ${s.accent}`}
                />
                <p className="text-sm font-semibold text-content">{p.action}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* The compiled, checkable list for next week */}
      <Card className="mt-5">
        <p className="text-sm font-bold text-content">Next week, this is the list</p>
        <div className="mt-3 flex flex-col gap-2">
          {TODO.map((t, i) => {
            const on = done.has(i);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleDone(i)}
                className="flex items-start gap-3 text-left"
              >
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                    on ? 'border-primary bg-primary' : 'border-border-light'
                  }`}
                >
                  {on && <Icon icon="ic:round-check" width={13} className="text-white" />}
                </div>
                <span
                  className={`text-sm ${on ? 'text-content-tertiary line-through' : 'text-content'}`}
                >
                  {t}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <button
        type="button"
        className="mt-4 w-full rounded-full bg-primary py-3.5 text-base font-bold text-white"
      >
        Set this as my plan
      </button>
    </div>
  );
}
