import { Icon } from '@iconify/react';
import { useState } from 'react';

// Screen Time · Moment 02 from the teardown: picking apps, then the reasons you
// reach for them. The category stops at the app list; GG treats the next question
// (why you actually open them, in plain words) as the real product. Captured once
// at setup, surfaced again at the blocked moment. Our UI/UX, Yair's flow. Mock.

const APPS = [
  { label: 'Instagram', short: 'IG', color: 'bg-gradient-to-br from-fuchsia-500 to-amber-400' },
  { label: 'TikTok', short: 'TT', color: 'bg-slate-900' },
  { label: 'X', short: 'X', color: 'bg-slate-800' },
  { label: 'Reddit', short: 'R', color: 'bg-orange-500' },
];

// The reasons adapt to the kind of apps picked. For social/feed apps, these are
// the honest ones people actually name.
const REASONS = [
  { key: 'break', icon: 'ph:coffee-bold', label: 'Take a break' },
  { key: 'escape', icon: 'ph:cloud-fog-bold', label: 'Escape or numb out' },
  { key: 'fomo', icon: 'ph:eye-bold', label: 'Stay in the loop' },
  { key: 'bored', icon: 'ph:hourglass-low-bold', label: 'Boredom, nothing to do' },
  { key: 'sleep', icon: 'ph:moon-bold', label: 'Cannot sleep' },
  { key: 'real', icon: 'ph:chat-circle-bold', label: 'Real work or connection' },
];

type Step = 'apps' | 'reasons' | 'done';

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

export function SetupReasonsPreview({ onBack }: { onBack?: () => void } = {}) {
  const [step, setStep] = useState<Step>('apps');
  const [apps, setApps] = useState<Set<string>>(new Set(['Instagram', 'TikTok']));
  const [reasons, setReasons] = useState<Set<string>>(new Set(['break', 'escape']));

  const toggle = (set: Set<string>, key: string, put: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    put(next);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg px-5 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => {
            if (step === 'reasons') setStep('apps');
            else if (step === 'done') setStep('reasons');
            else onBack?.();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary text-content"
        >
          <Icon icon="ic:round-chevron-left" width={22} />
        </button>
        <h1 className="text-[22px] font-semibold text-content">Set up</h1>
      </div>

      {/* Step 1: apps, via the system picker everyone already trusts. */}
      {step === 'apps' && (
        <div className="mt-6 flex flex-1 flex-col">
          <h2 className="text-lg font-bold text-content">Which apps do you want to work on?</h2>
          <p className="mt-1 text-sm text-content-secondary">Tap the ones that get you.</p>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {APPS.map((a) => {
              const on = apps.has(a.label);
              return (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => toggle(apps, a.label, setApps)}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
                    on ? 'border-primary bg-primary/5' : 'border-border-light bg-surface'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${a.color}`}
                  >
                    {a.short}
                  </div>
                  <span className="flex-1 text-sm font-bold text-content">{a.label}</span>
                  {on && <Icon icon="ic:round-check-circle" width={22} className="text-primary" />}
                </button>
              );
            })}
          </div>
          <div className="mt-auto pt-6">
            <PrimaryBtn
              label="Next: your reasons"
              onClick={() => setStep('reasons')}
              disabled={apps.size === 0}
            />
          </div>
        </div>
      )}

      {/* Step 2: the real question. Reasons in plain words, pick as many as fit. */}
      {step === 'reasons' && (
        <div className="mt-6 flex flex-1 flex-col">
          <h2 className="text-lg font-bold text-content">
            What are the reasons you reach for them?
          </h2>
          <p className="mt-1 text-sm text-content-secondary">
            Pick as many as fit. I will bring these up in the moment, not judge them now.
          </p>
          <div className="mt-5 flex flex-col gap-2.5">
            {REASONS.map((r) => {
              const on = reasons.has(r.key);
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => toggle(reasons, r.key, setReasons)}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
                    on ? 'border-primary bg-primary/5' : 'border-border-light bg-surface'
                  }`}
                >
                  <Icon
                    icon={r.icon}
                    width={22}
                    className={`shrink-0 ${on ? 'text-primary' : 'text-content-tertiary'}`}
                  />
                  <span className="flex-1 text-sm font-semibold text-content">{r.label}</span>
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
              label="Save my reasons"
              onClick={() => setStep('done')}
              disabled={reasons.size === 0}
            />
          </div>
        </div>
      )}

      {/* Step 3: confirmation that the reasons come back when it matters. */}
      {step === 'done' && (
        <div className="mt-6 flex flex-1 flex-col">
          <div className="rounded-3xl bg-surface p-6 shadow-card">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
              <Icon icon="ph:check-bold" width={26} className="text-emerald-600" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-content">Saved. That is enough to help.</h2>
            <p className="mt-2 text-sm leading-relaxed text-content-secondary">
              When you reach for {[...apps][0]}
              {apps.size > 1 ? ` or ${[...apps][1]}` : ''}, I will ask which of these is really
              driving it, and whether opening it gives you that.
            </p>
          </div>

          <p className="mt-6 text-xs font-bold uppercase tracking-wide text-content-tertiary">
            What I will bring up
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...reasons].map((k) => {
              const r = REASONS.find((x) => x.key === k);
              if (!r) return null;
              return (
                <span
                  key={k}
                  className="rounded-full bg-primary-bg px-3 py-1.5 text-sm font-semibold text-content"
                >
                  {r.label}
                </span>
              );
            })}
          </div>

          <div className="mt-auto pt-6">
            <PrimaryBtn label="Done" onClick={() => onBack?.()} />
          </div>
        </div>
      )}
    </div>
  );
}
