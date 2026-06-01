import { Icon } from '@iconify/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { FocusControls } from '@/components/focus/FocusControls';
import { FocusSessionSheet } from '@/components/focus/FocusSessionSheet';
import { FocusTimer } from '@/components/focus/FocusTimer';
import { ConfirmDialog } from '@/components/settings/ConfirmDialog';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/contexts/ToastContext';
import { useFocusSession } from '@/hooks/useFocusSession';
import { useFocusTimer } from '@/hooks/useFocusTimer';
import { useHabits } from '@/hooks/useHabits';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import { useSessionLog } from '@/hooks/useSessionLog';
import { speak } from '@/lib/services/tts-service';

export function FocusPage() {
  const timer = useFocusTimer();
  const { habits } = useHabits();
  const { saveFocusSession, error: saveError } = useFocusSession();
  const { addToast } = useToast();
  const { logEvent } = useSessionLog();
  const navigate = useNavigate();

  const [showSheet, setShowSheet] = useState(false);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  // When the exit guard fires, we stash the intended destination here (or
  // `null` if the user pressed hardware/browser back) and open the modal.
  // Confirming cancels the session and navigates; dismissing keeps the user.
  const [pendingExit, setPendingExit] = useState<{ to: string | null } | null>(null);

  // Track session start time
  const sessionStartRef = useRef<string | null>(null);

  const selectedHabit = habits.find((h) => h.id === selectedHabitId);

  useEffect(() => {
    track('view_focus');
  }, []);

  // Show toast when save fails
  useEffect(() => {
    if (saveError) {
      addToast('error', `Failed to save session: ${saveError}`);
    }
  }, [saveError, addToast]);

  // Save session when timer completes
  const prevStatus = useRef(timer.status);
  useEffect(() => {
    if (prevStatus.current !== 'completed' && timer.status === 'completed') {
      const startedAt = sessionStartRef.current || new Date().toISOString();
      // INT column — floor sub-minute sessions to 1 so they persist
      const durationMinutes = Math.max(1, Math.round(timer.totalSeconds / 60));
      const habitLabel = selectedHabit?.name ?? null;

      saveFocusSession(selectedHabitId, durationMinutes, durationMinutes, startedAt).then(
        (session) => {
          if (session) {
            track('complete_focus_session', {
              duration_minutes: durationMinutes,
              linked_habit: habitLabel,
              was_interrupted: false,
            });
          }
        },
      );
      logEvent(
        'focus_ended',
        { habit_id: selectedHabitId, duration_min: durationMinutes, status: 'completed' },
        'FOCUS-TIMER',
      );
      sessionStartRef.current = null;
    }
    prevStatus.current = timer.status;
  }, [
    timer.status,
    timer.totalSeconds,
    selectedHabitId,
    selectedHabit?.name,
    saveFocusSession,
    logEvent,
  ]);

  // TTS on status changes per Voice Journey Spreadsheet v3 (line 524-532)
  const prevTTSStatus = useRef(timer.status);
  useEffect(() => {
    if (prevTTSStatus.current !== timer.status) {
      if (timer.status === 'running' && prevTTSStatus.current !== 'paused') {
        // On start
        const mins = Math.round(timer.totalSeconds / 60);
        const habitLabel = selectedHabit?.name || 'focus';
        speak(`${mins} minutes of ${habitLabel}. Timer starts now. Go.`);
      } else if (timer.status === 'completed') {
        // On complete
        const mins = Math.round(timer.totalSeconds / 60);
        const habitLabel = selectedHabit?.name || 'focus';
        speak(`Time's up. ${mins} minutes of ${habitLabel} \u2014 done. Nice work.`);
      }
    }
    prevTTSStatus.current = timer.status;
  }, [timer.status, timer.totalSeconds, selectedHabit?.name]);

  const handleStart = useCallback(() => {
    if (!selectedHabitId) {
      addToast('error', 'Pick a habit to start your focus session');
      setShowSheet(true);
      return;
    }
    const durationMinutes = Math.round(timer.totalSeconds / 60);
    track('start_focus_session', {
      duration_set_minutes: durationMinutes,
      linked_habit: selectedHabit?.name ?? null,
      notification_enabled: notify,
    });
    logEvent(
      'focus_started',
      { habit_id: selectedHabitId, duration_min: durationMinutes },
      'FOCUS-TIMER',
    );
    sessionStartRef.current = new Date().toISOString();
    timer.start();
  }, [timer, selectedHabitId, selectedHabit?.name, notify, addToast, logEvent]);

  const handlePause = useCallback(() => {
    const elapsedSeconds = timer.totalSeconds - timer.remainingSeconds;
    track('pause_focus_session', {
      elapsed_minutes: Math.round(elapsedSeconds / 60),
      linked_habit: selectedHabit?.name ?? null,
    });
    timer.pause();
  }, [timer, selectedHabit?.name]);

  // Guard active only when a session is in flight. Idle (not started) and
  // completed (already saved by the completion effect) exit silently.
  const isSessionActive = timer.status === 'running' || timer.status === 'paused';

  // Track pendingExit via a ref so the guard's capture-phase listener (which
  // stays armed while the modal is open) bails on the second tap instead of
  // overwriting the stashed destination from the first.
  const pendingExitRef = useRef<{ to: string | null } | null>(null);
  useEffect(() => {
    pendingExitRef.current = pendingExit;
  }, [pendingExit]);

  const handleExitAttempt = useCallback((to: string | null) => {
    if (pendingExitRef.current) return;
    setPendingExit({ to });
  }, []);

  useNavigationGuard(isSessionActive, handleExitAttempt);

  // Auto-close the dialog if the timer naturally completes while it's open —
  // otherwise the modal copy ("still running") lies and the back path lands
  // somewhere unexpected once the guard tears down underneath it.
  useEffect(() => {
    if (!isSessionActive && pendingExit) setPendingExit(null);
  }, [isSessionActive, pendingExit]);

  const handleStop = useCallback(() => {
    // Include 'paused': the guard fires for both, so a paused exit must
    // still emit telemetry + clear sessionStartRef (otherwise it leaks
    // into the next session's start timestamp).
    if (sessionStartRef.current && (timer.status === 'running' || timer.status === 'paused')) {
      const durationMinutes = Math.max(1, Math.round(timer.totalSeconds / 60));
      const elapsedSeconds = timer.totalSeconds - timer.remainingSeconds;
      const habitLabel = selectedHabit?.name ?? null;
      const startedAt = sessionStartRef.current;
      // Skip save if the user stops in the first second — likely a misclick
      const skipSave = elapsedSeconds < 1;
      const actualMinutes = skipSave ? 0 : Math.max(1, Math.round(elapsedSeconds / 60));
      const completionPct =
        durationMinutes > 0 ? Math.round((actualMinutes / durationMinutes) * 100) : 0;

      if (!skipSave) {
        saveFocusSession(selectedHabitId, durationMinutes, actualMinutes, startedAt).then(
          (session) => {
            if (session) {
              track('abandon_focus_session', {
                elapsed_minutes: actualMinutes,
                total_duration_minutes: durationMinutes,
                completion_percentage: completionPct,
                linked_habit: habitLabel,
              });
            }
          },
        );
      } else {
        track('abandon_focus_session', {
          elapsed_minutes: actualMinutes,
          total_duration_minutes: durationMinutes,
          completion_percentage: completionPct,
          linked_habit: habitLabel,
          skipped_save: true,
        });
      }
      logEvent(
        'focus_ended',
        { habit_id: selectedHabitId, duration_min: actualMinutes, status: 'cancelled' },
        'FOCUS-TIMER',
      );
      sessionStartRef.current = null;
    }
    timer.stop();
  }, [timer, selectedHabitId, selectedHabit?.name, saveFocusSession, logEvent]);

  const handleConfirmExit = useCallback(() => {
    // Cancel the session FIRST (fires focus_ended cancelled + abandon_focus_session),
    // then navigate. handleStop sets timer.status to 'idle' which deactivates
    // the navigation guard before we navigate.
    handleStop();
    const to = pendingExit?.to ?? null;
    setPendingExit(null);
    // Defer navigation a tick so state updates flush and the guard tears down
    // its capture-phase click listener before the router-level navigate fires.
    setTimeout(() => {
      if (to) {
        navigate(to);
      } else {
        // Back-path: stack is [..., prev, /focus, sentinel]. One back step
        // pops only the sentinel and lands on the duplicate /focus entry,
        // not on prev — so use go(-2) to actually leave /focus.
        window.history.go(-2);
      }
    }, 0);
  }, [handleStop, navigate, pendingExit]);

  const handleDismissExit = useCallback(() => {
    setPendingExit(null);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <div className="px-6 pt-[max(2rem,env(safe-area-inset-top))]">
        <h1 className="text-[28px] font-semibold leading-tight text-content">Focus Session</h1>
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
          onPause={handlePause}
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
              // Route through handleStart so focus_started fires here too
              // (previously this path bypassed the logEvent in handleStart).
              handleStart();
              setShowSheet(false);
            }}
          />
        </BottomSheet>
      )}

      {pendingExit && (
        <ConfirmDialog
          title="End focus session?"
          message="Your timer is still running. Leaving now will cancel this session."
          confirmLabel="End session"
          cancelLabel="Keep focusing"
          variant="danger"
          onConfirm={handleConfirmExit}
          onCancel={handleDismissExit}
        />
      )}
    </div>
  );
}
