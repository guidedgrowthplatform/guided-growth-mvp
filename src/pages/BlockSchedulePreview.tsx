import { Icon } from '@iconify/react';
import { useState } from 'react';
import { TimePicker, formatTime12 } from '@/components/ui/TimePicker';

// Screen Time · Block schedule. A recurring, habit-forming block: the user picks
// apps, picks a schedule (days + a time window), reviews, and saves. Once saved,
// reminders fire 30 and 10 minutes before the apps lock, so it is never a
// surprise. Self-regulation framing throughout. Interactive step flow. Mock.

const APPS = [
  { label: 'Socials', color: 'bg-violet-400' },
  { label: 'Video', color: 'bg-rose-400' },
  { label: 'News', color: 'bg-amber-400' },
  { label: 'Games', color: 'bg-sky-400' },
];

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type Step = 'apps' | 'schedule' | 'review' | 'saved';

function daysSummary(days: boolean[]): string {
  const on = days.map((d, i) => (d ? i : -1)).filter((i) => i >= 0);
  if (on.length === 7) return 'Every day';
  const weekday = [1, 2, 3, 4, 5];
  if (on.length === 5 && weekday.every((i) => days[i])) return 'Weekdays';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return on.map((i) => names[i]).join(', ');
}

function PrimaryBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full bg-primary py-3.5 text-base font-bold text-white transition-opacity disabled:opacity-40"
    >
      {label}
    </button>
  );
}

export function BlockSchedulePreview({ onBack }: { onBack?: () => void } = {}) {
  const [step, setStep] = useState<Step>('apps');
  const [picked, setPicked] = useState<Set<string>>(new Set(['Socials']));
  const [days, setDays] = useState<boolean[]>([false, true, true, true, true, true, false]);
  const [start, setStart] = useState('21:00');
  const [end, setEnd] = useState('23:00');

  const toggleApp = (label: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const toggleDay = (i: number) => setDays((prev) => prev.map((d, idx) => (idx === i ? !d : d)));

  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg px-5 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        {(onBack || (step !== 'apps' && step !== 'saved')) && (
          <button
            type="button"
            aria-label="Back"
            onClick={() => {
              if (step === 'schedule') setStep('apps');
              else if (step === 'review') setStep('schedule');
              else onBack?.();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary text-content"
          >
            <Icon icon="ic:round-chevron-left" width={22} />
          </button>
        )}
        <h1 className="text-[22px] font-semibold text-content">Block schedule</h1>
      </div>

      {/* APPS */}
      {step === 'apps' && (
        <div className="mt-6 flex flex-1 flex-col">
          <p className="text-sm text-content-secondary">Which apps should this cover?</p>
          <div className="mt-4 flex flex-col gap-2.5">
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
          <div className="mt-auto pt-6">
            <PrimaryBtn
              label="Next"
              onClick={() => setStep('schedule')}
              disabled={picked.size === 0}
            />
          </div>
        </div>
      )}

      {/* SCHEDULE */}
      {step === 'schedule' && (
        <div className="mt-6 flex flex-1 flex-col">
          <p className="text-sm text-content-secondary">When should they lock?</p>

          <p className="mt-5 text-xs font-bold uppercase tracking-wide text-content-tertiary">
            Days
          </p>
          <div className="mt-2 flex justify-between">
            {DAY_LABELS.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                  days[i] ? 'bg-primary text-white' : 'bg-surface text-content-tertiary'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <div className="flex items-center justify-between rounded-2xl bg-surface p-4 shadow-sm">
              <span className="text-sm font-semibold text-content">From</span>
              <TimePicker value={start} onChange={setStart} />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-surface p-4 shadow-sm">
              <span className="text-sm font-semibold text-content">Until</span>
              <TimePicker value={end} onChange={setEnd} />
            </div>
          </div>

          <div className="mt-auto pt-6">
            <PrimaryBtn label="Review" onClick={() => setStep('review')} />
          </div>
        </div>
      )}

      {/* REVIEW */}
      {step === 'review' && (
        <div className="mt-6 flex flex-1 flex-col">
          <div className="rounded-3xl bg-surface p-5 shadow-card">
            <p className="text-xs font-bold uppercase tracking-wide text-content-tertiary">Apps</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[...picked].map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-primary-bg px-3 py-1.5 text-sm font-bold text-content"
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="my-4 h-px bg-border-light" />
            <p className="text-xs font-bold uppercase tracking-wide text-content-tertiary">When</p>
            <p className="mt-1 text-base font-semibold text-content">{daysSummary(days)}</p>
            <p className="text-sm text-content-secondary">
              {formatTime12(start)} to {formatTime12(end)}
            </p>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <Icon icon="ph:bell-ringing-bold" width={22} className="mt-0.5 shrink-0 text-primary" />
            <p className="text-sm text-content">
              We will nudge you 30 and 10 minutes before it locks, so it is never a surprise.
            </p>
          </div>

          <div className="mt-auto flex flex-col gap-2.5 pt-6">
            <PrimaryBtn label="Done" onClick={() => setStep('saved')} />
            <button
              type="button"
              onClick={() => setStep('schedule')}
              className="w-full py-2 text-sm font-semibold text-content-secondary"
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {/* SAVED */}
      {step === 'saved' && (
        <div className="mt-6 flex flex-1 flex-col">
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4">
            <Icon icon="ph:check-circle-fill" width={24} className="text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-800">Schedule saved. You are set.</p>
          </div>

          <p className="mt-6 text-xs font-bold uppercase tracking-wide text-content-tertiary">
            Your schedules
          </p>
          <div className="mt-2 rounded-2xl bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-content">{[...picked].join(', ')}</p>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                On
              </span>
            </div>
            <p className="mt-0.5 text-sm text-content-secondary">
              {daysSummary(days)} · {formatTime12(start)}–{formatTime12(end)}
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-content-tertiary">
              <Icon icon="ph:bell-ringing" width={14} />
              Reminders 30 and 10 min before
            </div>
          </div>

          {/* What the pre-lock reminder reads like. */}
          <p className="mt-6 text-xs font-bold uppercase tracking-wide text-content-tertiary">
            Reminder preview
          </p>
          <div className="mt-2 rounded-2xl bg-surface p-4 shadow-sm">
            <p className="text-sm font-bold text-content">10 minutes of {[...picked][0]} left</p>
            <p className="mt-0.5 text-sm text-content-secondary">
              It locks at {formatTime12(start)}. A good moment to wrap up.
            </p>
          </div>

          <div className="mt-auto pt-6">
            <button
              type="button"
              onClick={() => setStep('apps')}
              className="w-full py-2 text-sm font-semibold text-content-secondary"
            >
              Add another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
