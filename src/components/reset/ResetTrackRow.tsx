import { Icon } from '@iconify/react';

interface ResetTrackRowProps {
  title: string;
  whatFor: string;
  /** Left-side leading indicator: a duration chip (guided) or a wave glyph (soundscape). */
  kind: 'guided' | 'soundscape';
  durationSec: number;
  /** True for the paired Settle row -- shows an EN/HE affordance instead of nothing. */
  paired?: boolean;
  onClick: () => void;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  // Whole-minute tracks read as "2m"; off-minute ones (e.g. 90s) keep the
  // seconds as "1:30" instead of rounding away to a wrong "2m".
  if (rem === 0) return `${min}m`;
  return `${min}:${String(rem).padStart(2, '0')}`;
}

export function ResetTrackRow({
  title,
  whatFor,
  kind,
  durationSec,
  paired,
  onClick,
}: ResetTrackRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border-light bg-surface p-4 text-left shadow-sm transition-shadow active:shadow-card-hover"
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-bg">
        {kind === 'soundscape' ? (
          <Icon icon="ph:waves-bold" width={22} className="text-primary" />
        ) : (
          <span className="text-xs font-bold text-primary">{formatDuration(durationSec)}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-content">{title}</p>
        <p className="truncate text-xs font-normal text-content-secondary">{whatFor}</p>
      </div>

      {paired && (
        <span className="shrink-0 rounded-full bg-surface-secondary px-2.5 py-1 text-[11px] font-bold text-content-secondary">
          EN / HE
        </span>
      )}

      <Icon icon="ic:round-chevron-right" width={20} className="shrink-0 text-content-tertiary" />
    </button>
  );
}
