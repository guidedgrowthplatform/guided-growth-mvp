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

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startInterval = useCallback(() => {
    clearTimer();
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearTimer();
          setStatus('completed');
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Focus Session Complete!', {
              body: 'Great job staying focused!',
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimer]);

  const start = useCallback(() => {
    if (status !== 'idle') return;
    setStatus('running');
    startInterval();
  }, [status, startInterval]);

  const pause = useCallback(() => {
    if (status !== 'running') return;
    clearTimer();
    setStatus('paused');
  }, [status, clearTimer]);

  const resume = useCallback(() => {
    if (status !== 'paused') return;
    setStatus('running');
    startInterval();
  }, [status, startInterval]);

  const stop = useCallback(() => {
    clearTimer();
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
