import { Icon } from '@iconify/react';
import { useState } from 'react';

// Screen Time · Moment 10 from the teardown: privacy, shown not promised. On iOS,
// exact app names and per-app minutes are sealed on the phone by the platform.
// The differentiator is not the claim, it is showing exactly what the coach knows
// as a screen you can tap, not a policy page. Two layers side by side: the same
// detailed on-device report every blocker renders locally, and a separate, honest
// list of what the coach actually uses. Our UI/UX. Mock.

type Layer = 'phone' | 'coach';

const PHONE_REPORT = [
  { label: 'Late-night feeds', value: '47 of 60 min' },
  { label: 'Messaging', value: '1h 12m' },
  { label: 'Video', value: '38 min' },
];

const COACH_KNOWS = [
  'You named this group "late-night feeds"',
  'It crossed the 60-minute boundary tonight',
  'You chose "five more minutes" at 10:52',
  'You told me it was to avoid an email',
];

export function PrivacyPreview({ onBack }: { onBack?: () => void } = {}) {
  const [layer, setLayer] = useState<Layer>('coach');

  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg px-5 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => onBack?.()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary text-content"
        >
          <Icon icon="ic:round-chevron-left" width={22} />
        </button>
        <h1 className="text-[22px] font-semibold text-content">What I can see</h1>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-content-secondary">
        For privacy, I see your boundaries and categories and the moments a limit came up, not every
        tap.
      </p>

      {/* The two honest layers, as a toggle you can actually check. */}
      <div className="mt-5 flex gap-1 rounded-full bg-surface-secondary p-1">
        {(['phone', 'coach'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setLayer(k)}
            className={`flex-1 rounded-full py-2 text-sm font-bold transition-colors ${
              layer === k ? 'bg-surface text-content shadow-sm' : 'text-content-tertiary'
            }`}
          >
            {k === 'phone' ? 'On your phone' : 'What your coach knows'}
          </button>
        ))}
      </div>

      {layer === 'phone' ? (
        <div className="mt-5">
          <div className="rounded-3xl bg-surface p-5 shadow-card">
            <div className="flex items-center gap-2">
              <Icon icon="ph:lock-key-bold" width={20} className="text-emerald-600" />
              <p className="text-sm font-bold text-content">Your detailed report</p>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {PHONE_REPORT.map((r) => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="text-sm text-content">{r.label}</span>
                  <span className="text-sm font-bold text-content">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 flex items-start gap-2 px-1 text-xs text-content-secondary">
            <Icon
              icon="ph:device-mobile-bold"
              width={16}
              className="mt-0.5 shrink-0 text-emerald-600"
            />
            Exact minutes, every app, every pickup. Yours to look at, and it stays on this screen. I
            never receive this.
          </p>
        </div>
      ) : (
        <div className="mt-5">
          <div className="rounded-3xl bg-surface p-5 shadow-card">
            <div className="flex items-center gap-2">
              <Icon icon="ph:sparkle-bold" width={20} className="text-primary" />
              <p className="text-sm font-bold text-content">What your coach knows</p>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {COACH_KNOWS.map((c) => (
                <div key={c} className="flex items-start gap-2.5">
                  <Icon icon="ph:check-bold" width={16} className="mt-0.5 shrink-0 text-primary" />
                  <span className="text-sm text-content">{c}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 flex items-start gap-2 px-1 text-xs text-content-secondary">
            <Icon icon="ph:eye-slash-bold" width={16} className="mt-0.5 shrink-0 text-primary" />
            Boundaries, categories, and the moments they came up, plus what you tell me. No exact
            minutes, no app names.
          </p>
        </div>
      )}

      {/* The plain sees / never-sees summary, so it reads as a kept promise. */}
      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <Icon icon="ph:check-circle-bold" width={22} className="text-emerald-600" />
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-emerald-700">I see</p>
          <p className="mt-1 text-sm text-emerald-900">
            Your boundaries, categories, and the moments they crossed
          </p>
        </div>
        <div className="rounded-2xl border border-border-light bg-surface p-4">
          <Icon icon="ph:x-circle-bold" width={22} className="text-content-tertiary" />
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-content-tertiary">
            I never see
          </p>
          <p className="mt-1 text-sm text-content">Exact minutes, app names, or your screen</p>
        </div>
      </div>
    </div>
  );
}
