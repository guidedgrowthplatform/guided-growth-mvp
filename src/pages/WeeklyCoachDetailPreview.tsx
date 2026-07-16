import { Icon } from '@iconify/react';
import { useState } from 'react';
import { HabitProgressRing } from '@/components/insights/HabitProgressRing';
import { LineChart, Sparkline } from '@/components/preview/MiniCharts';

// Weekly Coach, upgraded. Two things make it feel like a coach and not a
// dashboard: (1) it reads the week ALOUD, with a voice toggle the user controls
// on the page, and (2) it turns the result into care, keep / level up / adjust /
// rest per habit, plus a next-week list. It also holds TWO honest weeks: a strong
// one and a gaps one, because coaching matters most on the hard week, where the
// frame is "a reassess is still a win", never a red failure. Throughout, the
// numbers are tied back to the user's OWN words from their check-ins. Mock.

type WeekKey = 'strong' | 'gaps';
type PlanKind = 'keep' | 'add' | 'adjust' | 'remove';

interface WeekData {
  greetTitle: string;
  greetSub: string;
  rings: { d: string; pct: number }[];
  conTag: string;
  conTagTone: string;
  conNote: string;
  line: number[];
  lineLabels: string[];
  highlight: number;
  solidCount: number;
  projection: string;
  watching: { icon: string; label: string; value: string; delta: string; tint: string }[];
  quotes: { day: string; word: string; note: string }[];
  progress: { name: string; sub: string; data: number[]; color: string }[];
  plan: { name: string; verdict: string; kind: PlanKind; why: string; action: string }[];
  readingTitle: string;
  reading: string;
  todo: string[];
  cta: string;
}

const WEEKS: Record<WeekKey, WeekData> = {
  strong: {
    greetTitle: 'Your week, seen',
    greetSub: 'I have been watching. Here is what I notice, and one thing for next week.',
    rings: [
      { d: 'M', pct: 100 },
      { d: 'T', pct: 100 },
      { d: 'W', pct: 60 },
      { d: 'T', pct: 100 },
      { d: 'F', pct: 80 },
      { d: 'S', pct: 40 },
      { d: 'S', pct: 0 },
    ],
    conTag: 'on track',
    conTagTone: 'text-emerald-600',
    conNote: 'Five weeks in. Keep this and you reach a full month next week.',
    line: [52, 61, 58, 72, 78, 88],
    lineLabels: ['W1', 'W2', 'W3', 'W4', 'Now', 'W6'],
    highlight: 4,
    solidCount: 5,
    projection: 'Dashed is where you land if this week holds',
    watching: [
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
    ],
    quotes: [
      { day: 'Tuesday', word: 'clear', note: 'right after the morning walk' },
      { day: 'Friday', word: 'proud', note: 'you kept the streak alive' },
    ],
    progress: [
      {
        name: 'Morning walk',
        sub: '5-day streak',
        data: [1, 1, 1, 0, 1, 1, 1],
        color: 'text-emerald-500',
      },
      {
        name: 'Evening reset',
        sub: 'Slips midweek',
        data: [1, 1, 0, 1, 0, 1, 1],
        color: 'text-primary',
      },
      {
        name: 'Journal',
        sub: 'Twice this week',
        data: [1, 0, 0, 1, 0, 0, 1],
        color: 'text-violet-500',
      },
    ],
    plan: [
      {
        name: 'Morning walk',
        verdict: 'Level up',
        kind: 'add',
        why: 'A 5-day streak. It is basically automatic now, so there is room to build on it.',
        action: 'Add a 5-minute stretch right after it',
      },
      {
        name: 'Evening reset',
        verdict: 'Adjust',
        kind: 'adjust',
        why: 'It holds every day except Wednesday, when the day runs long.',
        action: 'Move it 30 minutes earlier on Wednesdays',
      },
      {
        name: 'Journal',
        verdict: 'Rest it',
        kind: 'remove',
        why: 'Twice this week and trending down. It is fighting you right now.',
        action: 'Shrink it to one line, or pause it for a week',
      },
    ],
    readingTitle: 'One thing for next week',
    reading:
      'Your mornings are becoming automatic, that is real. The evening reset is the one that slips on Wednesdays. Let us protect just Wednesday evening. Small, and it lifts the whole week.',
    todo: [
      'Keep the morning walk, it is automatic now',
      'Add a 5-minute stretch after the walk',
      'Move the evening reset 30 minutes earlier on Wednesdays',
      'Shrink journaling to a single line',
    ],
    cta: 'Set this as my plan',
  },
  gaps: {
    greetTitle: 'A quieter week, and that is okay',
    greetSub:
      'Two days got away from you. That is information, not a verdict. Here is how I read it.',
    rings: [
      { d: 'M', pct: 100 },
      { d: 'T', pct: 0 },
      { d: 'W', pct: 0 },
      { d: 'T', pct: 60 },
      { d: 'F', pct: 0 },
      { d: 'S', pct: 40 },
      { d: 'S', pct: 0 },
    ],
    conTag: 'easing',
    conTagTone: 'text-amber-600',
    conNote:
      'This dipped, and dips are part of it. A reassess is still a win, not a reset to zero.',
    line: [72, 78, 74, 68, 41, 55],
    lineLabels: ['W1', 'W2', 'W3', 'W4', 'Now', 'W6'],
    highlight: 4,
    solidCount: 5,
    projection: 'Dashed is a gentle way back, not a demand',
    watching: [
      {
        icon: 'ph:target-bold',
        label: 'Consistency',
        value: '41%',
        delta: 'down this week',
        tint: 'text-amber-500',
      },
      {
        icon: 'ph:cloud-bold',
        label: 'Mood',
        value: 'Heavy',
        delta: 'low 3 days',
        tint: 'text-slate-400',
      },
      {
        icon: 'ph:battery-low-bold',
        label: 'Energy',
        value: 'Low',
        delta: 'running out early',
        tint: 'text-rose-400',
      },
    ],
    quotes: [
      { day: 'Wednesday', word: 'underwater', note: 'the day the reset slipped' },
      { day: 'Sunday', word: 'flat', note: 'nothing pushed, and that is okay' },
    ],
    progress: [
      {
        name: 'Morning walk',
        sub: 'Still held twice',
        data: [1, 0, 0, 1, 0, 0, 0],
        color: 'text-emerald-500',
      },
      {
        name: 'Evening reset',
        sub: 'Missed most nights',
        data: [1, 0, 0, 0, 0, 1, 0],
        color: 'text-primary',
      },
      {
        name: 'Journal',
        sub: 'Paused itself',
        data: [0, 0, 0, 0, 0, 0, 0],
        color: 'text-violet-500',
      },
    ],
    plan: [
      {
        name: 'Morning walk',
        verdict: 'Keep',
        kind: 'keep',
        why: 'This one still held through a heavy week. That matters more than the number.',
        action: 'It is your anchor, keep it exactly as is',
      },
      {
        name: 'Evening reset',
        verdict: 'Shrink',
        kind: 'adjust',
        why: 'Missed most nights because the days ran heavy, not because you failed it.',
        action: 'Make it 2 minutes this week, not the full thing',
      },
      {
        name: 'Journal',
        verdict: 'Rest it',
        kind: 'remove',
        why: 'It paused itself. One less thing to carry while the week is heavy.',
        action: 'Let it rest, we can bring it back when there is room',
      },
    ],
    readingTitle: 'How I read this week',
    reading:
      'Nothing here needs fixing today. You still showed up for the morning walk on the hardest days, and that is the thread to hold. Let the rest get smaller for a week. A gentler week is still a week you did not disappear from.',
    todo: [
      'Keep only the morning walk, nothing else is required',
      'Make the evening reset just 2 minutes',
      'Let journaling rest this week',
      'One check-in on Sunday, that is enough',
    ],
    cta: 'Set this gentler plan',
  },
};

const KIND_STYLE: Record<PlanKind, { chip: string; icon: string; accent: string }> = {
  keep: {
    chip: 'bg-emerald-50 text-emerald-600',
    icon: 'ph:anchor-bold',
    accent: 'text-emerald-500',
  },
  add: { chip: 'bg-sky-50 text-sky-600', icon: 'ph:plus-circle-bold', accent: 'text-sky-500' },
  adjust: {
    chip: 'bg-primary/10 text-primary',
    icon: 'ph:sliders-horizontal-bold',
    accent: 'text-primary',
  },
  remove: { chip: 'bg-amber-50 text-amber-600', icon: 'ph:moon-bold', accent: 'text-amber-500' },
};

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
  const [week, setWeek] = useState<WeekKey>('strong');
  const [done, setDone] = useState<Set<number>>(new Set());
  const w = WEEKS[week];

  const pickWeek = (k: WeekKey) => {
    setWeek(k);
    setDone(new Set());
  };
  const toggleDone = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="min-h-dvh bg-primary-bg px-5 pb-12 pt-[max(2.5rem,env(safe-area-inset-top))]">
      {/* Which week: a strong one, or a hard one. Coaching matters most on gaps. */}
      <div className="flex gap-1 rounded-full bg-surface-secondary p-1">
        {(['strong', 'gaps'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => pickWeek(k)}
            className={`flex-1 rounded-full py-2 text-sm font-bold transition-colors ${
              week === k ? 'bg-surface text-content shadow-sm' : 'text-content-tertiary'
            }`}
          >
            {k === 'strong' ? 'Strong week' : 'Gaps week'}
          </button>
        ))}
      </div>

      {/* Coach greeting -- specific, warm, feels seen (and reframes a hard week) */}
      <div className="mt-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Icon icon="ph:sparkle-fill" width={20} className="text-primary" />
        </div>
        <div>
          <p className="text-[22px] font-semibold leading-tight text-content">{w.greetTitle}</p>
          <p className="mt-1 text-sm text-content-secondary">{w.greetSub}</p>
        </div>
      </div>

      {/* The coach reads it aloud, with a voice toggle you control on the page */}
      <VoiceRecapBar />

      {/* Day rings */}
      <div className="mt-6 flex justify-between">
        {w.rings.map((r, i) => (
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
          <span className={`text-xs font-semibold ${w.conTagTone}`}>{w.conTag}</span>
        </div>
        <p className="text-xs text-content-secondary">{w.conNote}</p>
        <div className="mt-2">
          <LineChart
            data={w.line}
            labels={w.lineLabels}
            highlight={w.highlight}
            solidCount={w.solidCount}
            formatValue={(v) => `${v}%`}
          />
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-content-tertiary">
          <span className="inline-block h-2 w-4 rounded-full border-b-2 border-dashed border-primary" />
          {w.projection}
        </p>
      </Card>

      {/* What the coach is watching FOR you */}
      <p className="mt-7 text-sm font-bold text-content">What I am watching for you</p>
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {w.watching.map((item) => (
          <div key={item.label} className="rounded-2xl bg-surface p-3 shadow-sm">
            <Icon icon={item.icon} width={22} className={item.tint} />
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-content-tertiary">
              {item.label}
            </p>
            <p className="text-base font-bold text-content">{item.value}</p>
            <p className="text-[11px] text-content-secondary">{item.delta}</p>
          </div>
        ))}
      </div>

      {/* In the user's OWN words: the numbers, tied to what they actually said */}
      <p className="mt-7 text-sm font-bold text-content">In your own words</p>
      <p className="mt-1 text-xs text-content-secondary">
        From your check-ins this week. The numbers make more sense next to these.
      </p>
      <div className="mt-3 flex flex-col gap-2.5">
        {w.quotes.map((q) => (
          <div key={q.day} className="flex gap-3 rounded-2xl bg-surface p-4 shadow-sm">
            <Icon icon="ph:quotes-fill" width={20} className="mt-0.5 shrink-0 text-primary/40" />
            <p className="text-sm leading-relaxed text-content">
              On {q.day} you said it felt{' '}
              <span className="font-bold text-content">&ldquo;{q.word}&rdquo;</span>
              <span className="text-content-secondary">, {q.note}.</span>
            </p>
          </div>
        ))}
      </div>

      {/* Per-habit progress with sparklines */}
      <p className="mt-7 text-sm font-bold text-content">Every habit</p>
      <div className="mt-3 flex flex-col gap-2.5">
        {w.progress.map((p) => (
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
          <p className="text-sm font-bold text-content">{w.readingTitle}</p>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-content">{w.reading}</p>
      </Card>

      {/* The care layer: turn this week's result into a plan, habit by habit */}
      <p className="mt-7 text-sm font-bold text-content">Turn this week into next week</p>
      <p className="mt-1 text-xs text-content-secondary">
        Based on how each one went, here is what I would keep, grow, or ease off.
      </p>
      <div className="mt-3 flex flex-col gap-2.5">
        {w.plan.map((p) => {
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
          {w.todo.map((t, i) => {
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
        {w.cta}
      </button>
    </div>
  );
}
