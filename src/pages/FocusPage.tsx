import { Icon } from '@iconify/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FocusControls } from '@/components/focus/FocusControls';
import { FocusSessionSheet } from '@/components/focus/FocusSessionSheet';
import { FocusTimer } from '@/components/focus/FocusTimer';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useFocusSession } from '@/hooks/useFocusSession';
import { useFocusTimer } from '@/hooks/useFocusTimer';
import { useHabits } from '@/hooks/useHabits';

export function FocusPage() {
  const timer = useFocusTimer();
  const { habits } = useHabits();
  const { saveFocusSession } = useFocusSession();

  const [showSheet, setShowSheet] = useState(false);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);

  // Track session start time
  const sessionStartRef = useRef<string | null>(null);

  const selectedHabit = habits.find((h) => h.id === selectedHabitId);

  // Save session when timer completes
  const prevStatus = useRef(timer.status);
  useEffect(() => {
    if (prevStatus.current !== 'completed' && timer.status === 'completed') {
      const startedAt = sessionStartRef.current || new Date().toISOString();
      const durationMinutes = Math.round(timer.totalSeconds / 60);
      const actualMinutes = durationMinutes; // Timer ran to completion

      saveFocusSession(selectedHabitId, durationMinutes, actualMinutes, startedAt);
      sessionStartRef.current = null;
    }
    prevStatus.current = timer.status;
  }, [timer.status, timer.totalSeconds, selectedHabitId, saveFocusSession]);

  const handleStart = useCallback(() => {
    sessionStartRef.current = new Date().toISOString();
    timer.start();
  }, [timer]);

  const handleStop = useCallback(() => {
    // Save partial session on manual stop
    if (sessionStartRef.current && timer.status === 'running') {
      const durationMinutes = Math.round(timer.totalSeconds / 60);
      const elapsedSeconds = timer.totalSeconds - timer.remainingSeconds;
      const actualMinutes = Math.round(elapsedSeconds / 60);

      saveFocusSession(selectedHabitId, durationMinutes, actualMinutes, sessionStartRef.current);
      sessionStartRef.current = null;
    }
    timer.stop();
  }, [timer, selectedHabitId, saveFocusSession]);

  return (
    <div className="flex min-h-screen flex-col bg-surface-secondary pb-24">
      <div className="px-6 pt-8">
        <h1 className="text-2xl font-bold text-content">Focus Session</h1>
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setShowSheet(true)}
            className="inline-flex items-center gap-2 rounded-full border border-border-light bg-surface px-4 py-2 shadow-sm"
          >
            <span className="h-2 w-2 rounded-full bg-warning" />
            <span className="max-w-[160px] truncate text-sm font-semibold text-content">
              {selectedHabit?.name || 'Select a habit'}
            </span>
            <Icon
              icon="ic:round-keyboard-arrow-down"
              width={16}
              className="text-content-secondary"
            />
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <FocusTimer
          remainingSeconds={timer.remainingSeconds}
          progress={timer.progress}
          status={timer.status}
          onEditPress={() => setShowSheet(true)}
        />
      </div>

      <div className="flex flex-col items-center gap-10 px-6 pb-12">
        <FocusControls
          status={timer.status}
          onStart={handleStart}
          onPause={timer.pause}
          onResume={timer.resume}
          onStop={handleStop}
        />
        <div className="flex w-full items-center gap-2 rounded-full bg-primary-bg px-5 py-2.5">
          <Icon icon="si:ai-fill" width={24} className="text-[#FDD017]" />
          <span className="text-xs font-bold text-primary">
            Tap mic to set time (e.g., &quot;Focus for 30 minutes&quot;)
          </span>
        </div>
      </div>

      {showSheet && (
        <BottomSheet onClose={() => setShowSheet(false)}>
          <FocusSessionSheet
            habits={habits}
            selectedHabitId={selectedHabitId}
            notify={notify}
            onSelectHabit={setSelectedHabitId}
            onSetDurationSeconds={timer.setDurationSeconds}
            onToggleNotify={setNotify}
            onStart={() => {
              sessionStartRef.current = new Date().toISOString();
              timer.start();
              setShowSheet(false);
            }}
          />
        </BottomSheet>
      )}
    </div>
  );
}
