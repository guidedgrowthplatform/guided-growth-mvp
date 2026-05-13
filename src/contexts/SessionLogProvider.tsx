import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ApiError } from '@/api/client';
import { logSessionEvent } from '@/api/sessionLog';
import { offlineQueue } from '@/cache/offlineQueue';
import { supabase } from '@/lib/supabase';
import { isSessionLogEvent, type SessionLogEvent } from '@shared/types/session-events';
import { SessionLogContext, type SessionLogContextValue } from './SessionLogContext';

const SESSION_ID_KEY = 'gg_session_id';
const VOICE_ANCHORS_KEY = 'gg_voice_anchors';

interface VoiceAnchor {
  start_ts: number;
  screen_id?: string;
}

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

function persistVoiceAnchors(anchors: Map<string, VoiceAnchor>): void {
  try {
    const snapshot: Record<string, VoiceAnchor> = {};
    for (const [k, v] of anchors) snapshot[k] = v;
    sessionStorage.setItem(VOICE_ANCHORS_KEY, JSON.stringify(snapshot));
  } catch {
    // Quota / private mode — orphan recovery best-effort only.
  }
}

function readVoiceAnchors(): Record<string, VoiceAnchor> {
  try {
    const raw = sessionStorage.getItem(VOICE_ANCHORS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, VoiceAnchor>) : {};
  } catch {
    return {};
  }
}

function clearVoiceAnchors(): void {
  try {
    sessionStorage.removeItem(VOICE_ANCHORS_KEY);
  } catch {
    // ignore
  }
}

export function SessionLogProvider({ children }: { children: ReactNode }) {
  const sessionIdRef = useRef<string>(readOrCreateSessionId());
  const voiceAnchorsRef = useRef<Map<string, VoiceAnchor>>(new Map());

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
    () => {
      const buildBody = (
        event_type: SessionLogEvent,
        payload?: Record<string, unknown>,
        screen_id?: string,
      ) => ({
        session_id: sessionIdRef.current,
        event_type,
        ...(screen_id ? { screen_id } : {}),
        ...(payload ? { payload } : {}),
      });

      const dispatch = (body: ReturnType<typeof buildBody>) => {
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
      };

      const logEvent: SessionLogContextValue['logEvent'] = (event_type, payload, screen_id) => {
        if (!isSessionLogEvent(event_type)) {
          if (import.meta.env.DEV) {
            console.warn(`[session-log] unknown event_type: ${event_type}`);
          }
          return;
        }
        dispatch(buildBody(event_type, payload, screen_id));
      };

      const startVoice: SessionLogContextValue['startVoice'] = (screen_id, extra) => {
        const anchor_id = crypto.randomUUID();
        const start_ts = performance.now();
        voiceAnchorsRef.current.set(anchor_id, { start_ts, screen_id });
        persistVoiceAnchors(voiceAnchorsRef.current);
        logEvent(
          'voice_started',
          { ...(extra ?? {}), voice_anchor_id: anchor_id },
          screen_id,
        );
        return anchor_id;
      };

      const endVoice: SessionLogContextValue['endVoice'] = (anchor_id, reason, extra) => {
        const anchor = voiceAnchorsRef.current.get(anchor_id);
        if (!anchor) return;
        const duration_sec = Math.round((performance.now() - anchor.start_ts) / 1000);
        voiceAnchorsRef.current.delete(anchor_id);
        persistVoiceAnchors(voiceAnchorsRef.current);
        logEvent(
          'voice_ended',
          { ...(extra ?? {}), duration_sec, reason, voice_anchor_id: anchor_id },
          anchor.screen_id,
        );
      };

      return {
        get sessionId() {
          return sessionIdRef.current;
        },
        logEvent,
        startVoice,
        endVoice,
      };
    },
    [],
  );

  // Orphan recovery — anchors persisted by a prior page-session that closed
  // without endVoice get a tab_close_recovery voice_ended row.
  useEffect(() => {
    const orphans = readVoiceAnchors();
    const entries = Object.entries(orphans);
    if (entries.length === 0) return;
    clearVoiceAnchors();
    for (const [anchor_id, anchor] of entries) {
      value.logEvent(
        'voice_ended',
        {
          duration_sec: 0,
          reason: 'tab_close_recovery',
          voice_anchor_id: anchor_id,
        },
        anchor.screen_id,
      );
    }
  }, [value]);

  // pagehide is more reliable than beforeunload on iOS Safari. We snapshot
  // in-flight anchors so the next mount can fire voice_ended for them.
  // sendBeacon would be more immediate but can't carry the Authorization
  // header that /api/session_log requires.
  useEffect(() => {
    const onHide = () => persistVoiceAnchors(voiceAnchorsRef.current);
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  return <SessionLogContext.Provider value={value}>{children}</SessionLogContext.Provider>;
}
