import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import type { Metric } from '@shared/types';

const DURATIONS = [15, 25, 45, 60];

interface FocusSessionSheetProps {
  habits: Metric[];
  selectedHabit: string | null;
  duration: number;
  notify: boolean;
  onSelectHabit: (name: string) => void;
  onSelectDuration: (minutes: number) => void;
  onToggleNotify: (value: boolean) => void;
  onStart: () => void;
  onClose: () => void;
}

export function FocusSessionSheet({
  habits,
  selectedHabit,
  duration,
  notify,
  onSelectHabit,
  onSelectDuration,
  onToggleNotify,
  onStart,
  onClose,
}: FocusSessionSheetProps) {
  return (
    <BottomSheet onClose={onClose}>
      <div className="px-6 pb-8 pt-4">
        <h2 className="text-2xl font-bold text-content">Set Your Focus Session</h2>

        {/* Select Habit */}
        <div className="mt-6">
          <p className="text-sm font-bold uppercase tracking-wider text-content-secondary">
            Select Habit
          </p>
          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
            {habits.map((h) => (
              <button
                key={h.id}
                onClick={() => onSelectHabit(h.name)}
                className={`w-full rounded-lg p-3 text-left text-[15px] font-medium text-content transition-colors ${
                  selectedHabit === h.name
                    ? 'bg-primary-bg ring-2 ring-primary'
                    : 'bg-surface-secondary'
                }`}
              >
                {h.name}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="mt-6">
          <p className="text-sm font-bold uppercase tracking-wider text-content-secondary">
            Duration
          </p>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => onSelectDuration(d)}
                className={`rounded-3xl py-3 text-center text-sm font-bold transition-colors ${
                  duration === d
                    ? 'bg-primary text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.3)]'
                    : 'bg-border-light text-content'
                }`}
              >
                {d}m
              </button>
            ))}
          </div>
        </div>

        {/* Notification */}
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm font-medium text-content">Remind me when finished</span>
          <Toggle checked={notify} onChange={onToggleNotify} />
        </div>

        {/* CTA */}
        <div className="mt-6">
          <Button
            variant="primary"
            size="auth"
            fullWidth
            className="rounded-full font-bold shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.3)]"
            onClick={onStart}
          >
            Start Focusing
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
