import { useEffect, useRef } from 'react';
import { useSessionLog } from '@/hooks/useSessionLog';
import { drainBoundaryTransitions, isScreenTimeAvailable } from '@/lib/services/screenTime';

// Drains monitor-written band transitions into session_log on launch and on
// each foreground — the coach's screen-time signal (coach-data-contract.md).
// Renders nothing; mounted once inside <SessionLogProvider>.
export function ScreenTimeCoachBridge() {
  const { logEvent } = useSessionLog();
  const draining = useRef(false);

  useEffect(() => {
    if (!isScreenTimeAvailable()) return;

    const drain = async () => {
      if (draining.current) return;
      draining.current = true;
      try {
        const transitions = await drainBoundaryTransitions();
        for (const t of transitions) {
          logEvent('screentime_boundary_state_changed', {
            boundary_id: t.boundaryId,
            band: t.band,
            previous_band: t.previousBand,
            date: t.date,
          });
        }
      } finally {
        draining.current = false;
      }
    };

    void drain();
    let remove: (() => void) | undefined;
    void import('@capacitor/app').then(({ App: CapApp }) => {
      void CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void drain();
      }).then((handle) => {
        remove = () => void handle.remove();
      });
    });
    return () => remove?.();
  }, [logEvent]);

  return null;
}
