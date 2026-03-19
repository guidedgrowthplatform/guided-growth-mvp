import { Icon } from '@iconify/react';
import { useState } from 'react';
import { FocusControls } from '@/components/focus/FocusControls';
import { FocusSessionSheet } from '@/components/focus/FocusSessionSheet';
import { FocusTimer } from '@/components/focus/FocusTimer';
import { useFocusTimer } from '@/hooks/useFocusTimer';
import { useMetrics } from '@/hooks/useMetrics';

export function FocusPage() {
  const timer = useFocusTimer();
  const { metrics } = useMetrics();
  const [showSheet, setShowSheet] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);

  return (
    <div className="flex min-h-screen flex-col bg-surface-secondary pb-24">
      {/* Header */}
      <div className="px-6 pt-8">
        <h1 className="text-2xl font-bold text-content">Focus Session</h1>
        {/* Session pill dropdown */}
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setShowSheet(true)}
            className="inline-flex items-center gap-2 rounded-full border border-border-light bg-surface px-4 py-2 shadow-sm"
          >
            <span className="h-2 w-2 rounded-full bg-warning" />
            <span className="max-w-[160px] truncate text-sm font-semibold text-content">
              {selectedHabit || 'Select a habit'}
            </span>
            <Icon
              icon="ic:round-keyboard-arrow-down"
              width={16}
              className="text-content-secondary"
            />
          </button>
        </div>
      </div>

      {/* Timer */}
      <div className="flex flex-1 items-center justify-center px-6">
        <FocusTimer
          remainingSeconds={timer.remainingSeconds}
          progress={timer.progress}
          status={timer.status}
          onEditPress={() => setShowSheet(true)}
        />
      </div>

      {/* Controls + Badge */}
      <div className="flex flex-col items-center gap-10 px-6 pb-12">
        <FocusControls
          status={timer.status}
          onStart={timer.start}
          onPause={timer.pause}
          onResume={timer.resume}
          onStop={timer.stop}
        />
        {/* AI Guidance badge */}
        <div className="flex w-full items-center gap-2 rounded-full bg-primary-bg px-5 py-2.5">
          <Icon icon="si:ai-fill" width={24} className="text-[#FDD017]" />
          <span className="text-xs font-bold text-primary">
            Tap mic to set time (e.g., &quot;Focus for 30 minutes&quot;)
          </span>
        </div>
      </div>

      {/* Bottom Sheet */}
      {showSheet && (
        <FocusSessionSheet
          habits={metrics}
          selectedHabit={selectedHabit}
          duration={timer.totalSeconds / 60}
          notify={notify}
          onSelectHabit={setSelectedHabit}
          onSelectDuration={timer.setDuration}
          onToggleNotify={setNotify}
          onStart={() => {
            timer.start();
            setShowSheet(false);
          }}
          onClose={() => setShowSheet(false)}
        />
      )}
    </div>
  );
}
