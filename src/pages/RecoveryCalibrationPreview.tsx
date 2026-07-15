import { Icon } from '@iconify/react';
import { useState } from 'react';

// Screen Time · Moment 09 from the teardown: recovery after a slip. The category
// makes a miss a moral event (a broken streak, a hidden bypass, a hard lock). GG
// treats it as information: log the override without shame, then use the pattern
// to make the plan fit the life the person actually lives. When one boundary holds
// and a nearby one keeps slipping, the coach proposes moving the second one instead
// of locking harder. Our UI/UX. Mock.

const OVERRIDES = [
  { when: 'Tue 7:12pm', mins: '5 min' },
  { when: 'Wed 7:40pm', mins: '5 min' },
  { when: 'Fri 7:05pm', mins: '5 min' },
];

export function RecoveryCalibrationPreview({ onBack }: { onBack?: () => void } = {}) {
  const [moved, setMoved] = useState(false);

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
        <h1 className="text-[22px] font-semibold text-content">A quick calibration</h1>
      </div>

      <p className="mt-2 text-sm text-content-secondary">
        Nothing urgent, just a check-in on your evening boundaries.
      </p>

      {/* The two boundaries, one holding, one slipping. Plain counts, no red. */}
      <div className="mt-5 flex flex-col gap-2.5">
        <div className="flex items-center justify-between rounded-2xl bg-surface p-4 shadow-sm">
          <div>
            <p className="text-sm font-bold text-content">9:00pm feeds limit</p>
            <p className="text-xs text-content-tertiary">Every night this week</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-bold text-emerald-600">
            4 / 4 kept
          </span>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-surface p-4 shadow-sm">
          <div>
            <p className="text-sm font-bold text-content">7:00pm feeds limit</p>
            <p className="text-xs text-content-tertiary">Slips most nights</p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-[12px] font-bold text-amber-600">
            1 / 4 kept
          </span>
        </div>
      </div>

      {/* The coach's read: move it, do not lock it harder. */}
      <div className="mt-5 rounded-3xl bg-surface p-5 shadow-card">
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Icon icon="ph:sparkle-bold" width={18} className="text-primary" />
          </div>
          <p className="text-sm leading-relaxed text-content">
            You kept the 9pm one every night, but the 7pm one only once. That is not a failure, just
            information. Want to move it later, say 8:30?
          </p>
        </div>

        {moved ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 p-3.5">
            <Icon icon="ph:check-circle-fill" width={22} className="text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-800">
              Moved to 8:30pm. Let us see how that fits this week.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setMoved(true)}
              className="w-full rounded-full bg-primary py-3.5 text-base font-bold text-white"
            >
              Yes, move it to 8:30
            </button>
            <button
              type="button"
              onClick={() => setMoved(false)}
              className="w-full py-2 text-sm font-semibold text-content-secondary"
            >
              No, leave it at 7pm
            </button>
          </div>
        )}
      </div>

      {/* The override log, visible and plain, never a hidden violation record. */}
      <p className="mt-6 text-xs font-bold uppercase tracking-wide text-content-tertiary">
        Override log · no shame
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {OVERRIDES.map((o) => (
          <div
            key={o.when}
            className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 shadow-sm"
          >
            <span className="text-sm text-content">{o.when}</span>
            <span className="text-sm font-semibold text-content-tertiary">{o.mins}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
