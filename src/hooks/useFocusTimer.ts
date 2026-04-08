import { useCallback, useEffect, useRef, useState } from 'react';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface UseFocusTimerReturn {
  status: TimerStatus;
  totalSeconds: number;
  remainingSeconds: number;
  progress: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setDuration: (minutes: number) => void;
  setDurationSeconds: (seconds: number) => void;
}

export function useFocusTimer(initialMinutes = 25): UseFocusTimerReturn {
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [totalSeconds, setTotalSeconds] = useState(initialMinutes * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(initialMinutes * 60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Wall-clock anchor: when the timer was last started/resumed, and how many
  // seconds were already elapsed at that moment. We compute remaining from
  // (Date.now() - startTimestamp) instead of decrementing in setInterval —
  // setInterval pauses when the tab/app is backgrounded on mobile, so the
  // previous implementation made a 25-minute focus session take 40+ real
  // minutes if the user checked any other app during the session.
  const anchorRef = useRef<{ startedAt: number; elapsedAtStart: number } | null>(null);
  const completedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const computeRemaining = useCallback(() => {
    if (!anchorRef.current) return;
    const now = Date.now();
    const elapsedSinceAnchor = (now - anchorRef.current.startedAt) / 1000;
    const totalElapsed = anchorRef.current.elapsedAtStart + elapsedSinceAnchor;
    const newRemaining = Math.max(0, totalSeconds - Math.floor(totalElapsed));
    setRemainingSeconds(newRemaining);
    if (newRemaining === 0 && !completedRef.current) {
      completedRef.current = true;
      clearTimer();
      setStatus('completed');
      // Side effect outside the state updater — running it inside
      // setRemainingSeconds(prev => ...) caused double-fires under React
      // StrictMode in dev.
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Focus Session Complete!', {
          body: 'Great job staying focused!',
        });
      }
    }
  }, [totalSeconds, clearTimer]);

  const startInterval = useCallback(() => {
    clearTimer();
    // Tick once per second to update the UI, but compute from wall clock.
    intervalRef.current = setInterval(computeRemaining, 1000);
  }, [clearTimer, computeRemaining]);

  // When the page becomes visible again after being backgrounded, reconcile
  // the timer immediately so the user doesn't see the stale value.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'visible' && status === 'running') {
        computeRemaining();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [status, computeRemaining]);

  const start = useCallback(() => {
    if (status !== 'idle') return;
    completedRef.current = false;
    anchorRef.current = { startedAt: Date.now(), elapsedAtStart: 0 };
    setStatus('running');
    startInterval();
  }, [status, startInterval]);

  const pause = useCallback(() => {
    if (status !== 'running') return;
    // Capture how much wall-clock time has elapsed up to the pause moment,
    // so resume() can carry that forward against a fresh anchor.
    if (anchorRef.current) {
      const now = Date.now();
      const elapsedSinceAnchor = (now - anchorRef.current.startedAt) / 1000;
      anchorRef.current = {
        startedAt: now,
        elapsedAtStart: anchorRef.current.elapsedAtStart + elapsedSinceAnchor,
      };
    }
    clearTimer();
    setStatus('paused');
  }, [status, clearTimer]);

  const resume = useCallback(() => {
    if (status !== 'paused' || !anchorRef.current) return;
    // Reset the wall-clock anchor to "now" so subsequent ticks measure from
    // the resume moment forward. elapsedAtStart already holds the time
    // accrued before the pause.
    anchorRef.current = {
      startedAt: Date.now(),
      elapsedAtStart: anchorRef.current.elapsedAtStart,
    };
    setStatus('running');
    startInterval();
  }, [status, startInterval]);

  const stop = useCallback(() => {
    clearTimer();
    anchorRef.current = null;
    completedRef.current = false;
    setRemainingSeconds(totalSeconds);
    setStatus('idle');
  }, [clearTimer, totalSeconds]);

  const setDuration = useCallback(
    (minutes: number) => {
      if (status !== 'idle') return;
      const secs = minutes * 60;
      setTotalSeconds(secs);
      setRemainingSeconds(secs);
    },
    [status],
  );

  const setDurationSeconds = useCallback(
    (secs: number) => {
      if (status !== 'idle') return;
      setTotalSeconds(secs);
      setRemainingSeconds(secs);
    },
    [status],
  );

  const progress = totalSeconds > 0 ? (totalSeconds - remainingSeconds) / totalSeconds : 0;

  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  return {
    status,
    totalSeconds,
    remainingSeconds,
    progress,
    start,
    pause,
    resume,
    stop,
    setDuration,
    setDurationSeconds,
  };
}
