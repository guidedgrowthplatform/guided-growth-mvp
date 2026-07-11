import { Icon } from '@iconify/react';
import { useState } from 'react';
import { ResetNudgeSheet } from '@/components/reset/ResetNudgeSheet';

// Standalone, auth-free PREVIEW of the reset-nudge config, opened over a faux
// Reminders screen. Not the real settings surface -- shows the mock so it can be
// clicked the same way as /__reset-browse and /__reset-flow.
export function ResetNudgePreview() {
  const [open, setOpen] = useState(true);

  return (
    <div className="min-h-dvh bg-primary-bg px-6 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <h1 className="text-[22px] font-semibold text-content">Reminders</h1>
      <p className="mt-1 text-sm text-content-secondary">Choose when the app reaches out.</p>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 flex w-full items-center justify-between rounded-2xl border border-border-light bg-surface p-4 shadow-sm"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-bg">
            <Icon icon="ph:waves-bold" width={22} className="text-primary" />
          </span>
          <span className="text-base font-bold text-content">Reset nudges</span>
        </span>
        <Icon icon="ic:round-chevron-right" width={20} className="text-content-tertiary" />
      </button>

      {open && <ResetNudgeSheet onClose={() => setOpen(false)} />}
    </div>
  );
}
