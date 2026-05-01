import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/contexts/ToastContext';
import type { Habit } from '@/lib/services/data-service.interface';
import { TimePicker } from './ScrollWheelPicker';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const SECONDS = Array.from({ length: 12 }, (_, i) => i * 5);

interface FocusSessionSheetProps {
  habits: Habit[];
  selectedHabitId: string | null;
  notify: boolean;
  onSelectHabit: (id: string) => void;
  onSetDurationSeconds: (totalSeconds: number) => void;
  onToggleNotify: (value: boolean) => void;
  onStart: () => void;
}

export function FocusSessionSheet({
  habits,
  selectedHabitId,
  notify,
  onSelectHabit,
  onSetDurationSeconds,
  onToggleNotify,
  onStart,
}: FocusSessionSheetProps) {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const { addToast } = useToast();

  function handleStart() {
    if (!selectedHabitId) {
      addToast('error', 'Pick a habit to start your focus session');
      return;
    }
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    if (totalSeconds === 0) {
      addToast('error', 'Set a duration before starting');
      return;
    }
    onSetDurationSeconds(totalSeconds);
    onStart();
  }

  return (
    <div className="px-6 pb-8 pt-4">
      <h2 className="text-[24px] font-bold leading-[32px] text-content">Set Your Focus Session</h2>

      <div className="mt-6">
        <p className="text-[14px] font-bold uppercase tracking-[0.7px] text-content-secondary">
          Select Habit
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {habits.length === 0 && (
            <p className="py-2 text-sm text-content-tertiary">No active habits found.</p>
          )}
          {habits.map((h) => (
            <button
              key={h.id}
              onClick={() => onSelectHabit(h.id)}
              className={`w-full rounded-[16px] p-3 text-left text-[15px] font-medium text-content transition-colors ${
                selectedHabitId === h.id ? 'bg-primary-bg ring-2 ring-primary' : 'bg-surface'
              }`}
            >
              {h.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[14px] font-bold uppercase tracking-[0.7px] text-content-secondary">
          Duration
        </p>
        <div className="mt-3">
          <TimePicker
            hours={hours}
            minutes={minutes}
            seconds={seconds}
            onChangeHours={setHours}
            onChangeMinutes={setMinutes}
            onChangeSeconds={setSeconds}
            hourValues={HOURS}
            minuteValues={MINUTES}
            secondValues={SECONDS}
          />
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[14px] font-bold uppercase tracking-[0.7px] text-content-secondary">
          Notification
        </p>
        <div className="mt-3 flex items-center justify-between py-2">
          <span className="text-[16px] font-medium text-content">Remind Me When Finished</span>
          <Toggle checked={notify} onChange={onToggleNotify} />
        </div>
      </div>

      <div className="mt-6 pt-2">
        <Button
          variant="primary"
          size="auth"
          fullWidth
          className="rounded-full text-[18px] font-bold shadow-[0px_20px_25px_-5px_rgba(19,91,236,0.25),0px_8px_10px_-6px_rgba(19,91,236,0.25)]"
          onClick={handleStart}
        >
          Start Focusing
        </Button>
      </div>
    </div>
  );
}
