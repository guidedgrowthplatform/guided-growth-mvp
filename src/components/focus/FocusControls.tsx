import { Icon } from '@iconify/react';
import type { TimerStatus } from '@/hooks/useFocusTimer';

interface FocusControlsProps {
  status: TimerStatus;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function FocusControls({ status, onStart, onPause, onResume, onStop }: FocusControlsProps) {
  const showStop = status === 'running' || status === 'paused';

  const mainIcon =
    status === 'running'
      ? 'ic:round-pause'
      : status === 'completed'
        ? 'ic:round-replay'
        : 'ic:round-play-arrow';

  const mainAction =
    status === 'running'
      ? onPause
      : status === 'paused'
        ? onResume
        : status === 'completed'
          ? onStop
          : onStart;

  return (
    <div className="flex items-center gap-8">
      {/* Stop button */}
      <div className="flex w-14 justify-center">
        {showStop && (
          <button
            onClick={onStop}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-border"
          >
            <Icon icon="ic:round-stop" width={22} className="text-content" />
          </button>
        )}
      </div>

      {/* Play/Pause */}
      <button
        onClick={mainAction}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark shadow-[0px_20px_25px_-5px_rgba(191,219,254,0.5)]"
      >
        <Icon icon={mainIcon} width={36} className="text-white" />
      </button>

      {/* Spacer for symmetry */}
      <div className="w-14" />
    </div>
  );
}
