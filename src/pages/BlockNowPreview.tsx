import { Icon } from '@iconify/react';
import { useState } from 'react';

// Screen Time · Block now. An immediate, one-off block: pick apps, pick how long,
// and they lock right away. For the moment you want to step off the phone now,
// not on a recurring schedule. Self-regulation framing. Interactive. Mock.

const APPS = [
  { label: 'Socials', color: 'bg-violet-400' },
  { label: 'Video', color: 'bg-rose-400' },
  { label: 'News', color: 'bg-amber-400' },
  { label: 'Games', color: 'bg-sky-400' },
];

const DURATIONS = [
  { label: '30 min', mins: 30 },
  { label: '1 hour', mins: 60 },
  { label: '2 hours', mins: 120 },
  { label: 'Until tonight', mins: -1 },
];

type Phase = 'pick' | 'active';

export function BlockNowPreview({ onBack }: { onBack?: () => void } = {}) {
  const [phase, setPhase] = useState<Phase>('pick');
  const [picked, setPicked] = useState<Set<string>>(new Set(['Socials', 'Video']));
  const [duration, setDuration] = useState(30);

  const toggleApp = (label: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const durationLabel = DURATIONS.find((d) => d.mins === duration)?.label ?? '30 min';

  if (phase === 'active') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-7 bg-emerald-50 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <Icon icon="ph:lock-simple-fill" width={32} className="text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
            Blocking now
          </p>
          <h1 className="mt-2 text-4xl font-bold tabular-nums text-emerald-900">
            {duration === -1 ? 'Until tonight' : '29:41'}
          </h1>
          <p className="mt-3 text-base text-emerald-700">
            {[...picked].join(', ')} {picked.size > 1 ? 'are' : 'is'} off for{' '}
            {durationLabel.toLowerCase()}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPhase('pick')}
          className="text-sm font-semibold text-emerald-700 underline-offset-4"
        >
          End early
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg px-5 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            aria-label="Back"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary text-content"
          >
            <Icon icon="ic:round-chevron-left" width={22} />
          </button>
        )}
        <h1 className="text-[22px] font-semibold text-content">Block now</h1>
      </div>
      <p className="mt-1 text-sm text-content-secondary">Lock a few apps right away.</p>

      <p className="mt-6 text-xs font-bold uppercase tracking-wide text-content-tertiary">Apps</p>
      <div className="mt-2 flex flex-col gap-2.5">
        {APPS.map((a) => {
          const on = picked.has(a.label);
          return (
            <button
              key={a.label}
              type="button"
              onClick={() => toggleApp(a.label)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
                on ? 'border-primary bg-primary/5' : 'border-border-light bg-surface'
              }`}
            >
              <div className={`h-9 w-9 rounded-xl ${a.color}`} />
              <span className="flex-1 text-base font-bold text-content">{a.label}</span>
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                  on ? 'border-primary bg-primary' : 'border-border-light'
                }`}
              >
                {on && <Icon icon="ic:round-check" width={15} className="text-white" />}
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-xs font-bold uppercase tracking-wide text-content-tertiary">
        For how long
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {DURATIONS.map((d) => (
          <button
            key={d.mins}
            type="button"
            onClick={() => setDuration(d.mins)}
            className={`rounded-full px-4 py-2.5 text-sm font-bold transition-colors ${
              duration === d.mins
                ? 'bg-primary text-white'
                : 'border border-border-light bg-surface text-content-secondary'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={() => setPhase('active')}
          disabled={picked.size === 0}
          className="w-full rounded-full bg-primary py-3.5 text-base font-bold text-white transition-opacity disabled:opacity-40"
        >
          Start block
        </button>
      </div>
    </div>
  );
}
