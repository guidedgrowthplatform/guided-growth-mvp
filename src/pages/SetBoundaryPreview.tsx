import { Icon } from '@iconify/react';
import { useState } from 'react';

// Screen Time · Moment 04 from the teardown: a soft limit, not a wall. One named
// window and one soft limit, set in a tap. The limit is a tripwire the coach
// quietly watches, not a live countdown the user has to manage. Crossing it is a
// heads up, honest and no shame, never a locked wall. Our UI/UX. Mock.

export function SetBoundaryPreview({ onBack }: { onBack?: () => void } = {}) {
  const [limit, setLimit] = useState(20);
  const [saved, setSaved] = useState(false);
  const usedSoFar = 18;
  const crossed = usedSoFar >= limit;

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
        <h1 className="text-[22px] font-semibold text-content">Set a boundary</h1>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-content-secondary">
        One window, one soft limit. I will let you know if it is crossed. I am not counting every
        tap.
      </p>

      {/* The window, one tap, no schedule builder. */}
      <div className="mt-5 rounded-2xl bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Icon icon="ph:moon-stars-bold" width={22} className="shrink-0 text-primary" />
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
              Window
            </p>
            <p className="text-base font-bold text-content">8:00 PM to 10:00 PM</p>
          </div>
          <button type="button" className="text-sm font-semibold text-primary">
            Edit
          </button>
        </div>
      </div>

      {/* The apps, described by the user's own group name, never app names. */}
      <div className="mt-2.5 rounded-2xl bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Icon icon="ph:tag-bold" width={22} className="shrink-0 text-primary" />
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
              The apps you are limiting
            </p>
            <p className="text-base font-bold text-content">late-night feeds</p>
          </div>
        </div>
      </div>

      {/* The soft limit, adjustable in place. A tripwire, not a countdown. */}
      <div className="mt-5 rounded-3xl bg-surface p-6 shadow-card">
        <p className="text-sm font-medium text-content-secondary">Tonight so far</p>
        <p className="mt-1 text-4xl font-bold text-content">
          {usedSoFar} <span className="text-2xl text-content-tertiary">/ {limit} min</span>
        </p>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLimit((l) => Math.max(5, l - 5))}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-border-light bg-surface font-bold text-content"
          >
            <Icon icon="ic:round-remove" width={20} /> 5 min limit
          </button>
          <button
            type="button"
            onClick={() => setLimit((l) => Math.min(120, l + 5))}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-border-light bg-surface font-bold text-content"
          >
            <Icon icon="ic:round-add" width={20} /> 5 min limit
          </button>
        </div>

        <div
          className={`mt-4 flex items-start gap-2 rounded-2xl p-3.5 ${
            crossed ? 'bg-amber-50' : 'bg-emerald-50'
          }`}
        >
          <Icon
            icon={crossed ? 'ph:bell-ringing-bold' : 'ph:check-circle-bold'}
            width={20}
            className={`mt-0.5 shrink-0 ${crossed ? 'text-amber-600' : 'text-emerald-600'}`}
          />
          <p className={`text-sm ${crossed ? 'text-amber-800' : 'text-emerald-800'}`}>
            {crossed
              ? 'Crossed. I will send one gentle heads up, not a lock. You decide from there.'
              : 'Nothing crossed yet. I will only speak up if this one does.'}
          </p>
        </div>
      </div>

      <div className="mt-auto pt-6">
        {saved ? (
          <div className="flex items-center justify-center gap-2 rounded-full bg-emerald-50 py-3.5">
            <Icon icon="ph:check-circle-fill" width={22} className="text-emerald-600" />
            <span className="text-sm font-bold text-emerald-800">Boundary set. Rest easy.</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSaved(true)}
            className="w-full rounded-full bg-primary py-3.5 text-base font-bold text-white"
          >
            Protect my evening
          </button>
        )}
      </div>
    </div>
  );
}
