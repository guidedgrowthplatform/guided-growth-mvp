import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ApiError } from '@/api/client';
import { logSessionEvent } from '@/api/sessionLog';
import { offlineQueue } from '@/cache/offlineQueue';
import { supabase } from '@/lib/supabase';
import { isSessionLogEvent } from '@shared/types/session-events';
import { SessionLogContext, type SessionLogContextValue } from './SessionLogContext';

const SESSION_ID_KEY = 'gg_session_id';

function readOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, fresh);
    return fresh;
  } catch {
    // sessionStorage can throw in private-browsing / SSR / sandboxed contexts.
    // Fall back to an in-memory id so the rest of the app still works.
    return crypto.randomUUID();
  }
}

export function SessionLogProvider({ children }: { children: ReactNode }) {
  const sessionIdRef = useRef<string>(readOrCreateSessionId());

  // Rotate session_id on real user transitions: SIGNED_OUT, OR any event with
  // a user_id delta vs lastUserId. Same-id events (TOKEN_REFRESHED,
  // USER_UPDATED with unchanged id) do NOT rotate. The null→id transition
  // (anon → first login, including cold-boot INITIAL_SESSION) DOES rotate so
  // A→B handoff via signOut+signIn can't leak A's session_id to B.
  useEffect(() => {
    let lastUserId: string | null = null;
    let initialized = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const next = session?.user?.id ?? null;
      const idChanged = initialized && next !== lastUserId;
      const isUserTransition = event === 'SIGNED_OUT' || idChanged;
      if (isUserTransition) {
        const fresh = crypto.randomUUID();
        try {
          sessionStorage.setItem(SESSION_ID_KEY, fresh);
        } catch {
          // handled in readOrCreateSessionId
        }
        sessionIdRef.current = fresh;
      }
      lastUserId = next;
      initialized = true;
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: SessionLogContextValue = useMemo(
    () => ({
      get sessionId() {
        return sessionIdRef.current;
      },
      logEvent: (event_type, payload, screen_id) => {
        if (!isSessionLogEvent(event_type)) {
          if (import.meta.env.DEV) {
            console.warn(`[session-log] unknown event_type: ${event_type}`);
          }
          return;
        }
        const body = {
          session_id: sessionIdRef.current,
          event_type,
          ...(screen_id ? { screen_id } : {}),
          ...(payload ? { payload } : {}),
        };
        // Fire-and-forget. On network failure, queue for the next online tick.
        // 401 / 4xx means the event is unrecoverable (pre-auth or rejected
        // event_type) — drop it, don't keep retrying.
        logSessionEvent(body).catch((err: unknown) => {
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
            return;
          }
          // Defensive — enqueue should swallow internally, but Safari private
          // mode etc. can still throw. Don't let it become an unhandled rejection.
          try {
            offlineQueue.enqueue('/api/session_log', 'POST', body, 'session_log');
          } catch (enqueueErr) {
            if (import.meta.env.DEV) {
              console.warn('[session-log] enqueue failed', enqueueErr);
            }
          }
        });
      },
    }),
    [],
  );

  return <SessionLogContext.Provider value={value}>{children}</SessionLogContext.Provider>;
}
