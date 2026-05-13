import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Sentry } from '@/lib/sentry';
import { useScreenMap } from './useScreenMap';
import { useSessionLog } from './useSessionLog';

// Fires a `navigate` session_log event on every pathname change.
// Skips the first render (no "previous" screen yet); subsequent navigations
// emit { from_screen, to_screen, trigger: 'tap' }. Voice-driven navigation
// would emit its own event with trigger: 'voice' via useSessionLog directly.
export function useNavigateLogger() {
  const { pathname } = useLocation();
  const { routeToScreenId, isLoaded } = useScreenMap();
  const { logEvent } = useSessionLog();
  const prevScreenIdRef = useRef<string | null>(null);
  const skippedFirstRef = useRef(false);
  // Track pathnames we've already warned about so a tight render loop
  // doesn't spam the console / breadcrumb stream.
  const warnedPathnamesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Don't emit until the screen map has hydrated — without it every
    // navigate would log screen_id=UNKNOWN.
    if (!isLoaded) return;

    const resolved = routeToScreenId(pathname);
    const toScreenId = resolved ?? 'UNKNOWN';

    if (resolved === null && !warnedPathnamesRef.current.has(pathname)) {
      warnedPathnamesRef.current.add(pathname);
      Sentry.addBreadcrumb({
        category: 'navigation',
        message: 'Unmapped pathname → UNKNOWN',
        level: 'warning',
        data: { pathname },
      });
      if (import.meta.env.DEV) {
        console.warn(`[session-log] unmapped pathname "${pathname}" → screen_id=UNKNOWN`);
      }
    }

    if (!skippedFirstRef.current) {
      skippedFirstRef.current = true;
      prevScreenIdRef.current = toScreenId;
      return;
    }

    const fromScreenId = prevScreenIdRef.current;
    if (fromScreenId === toScreenId) return;

    logEvent(
      'navigate',
      { from_screen: fromScreenId, to_screen: toScreenId, trigger: 'tap' },
      toScreenId,
    );
    prevScreenIdRef.current = toScreenId;
  }, [pathname, isLoaded, routeToScreenId, logEvent]);
}
