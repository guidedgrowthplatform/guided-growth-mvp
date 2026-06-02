import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ApiError } from '@/api/client';
import { fetchSessionStateDelta } from '@/api/context';
import { logSessionEvent } from '@/api/sessionLog';
import { offlineQueue } from '@/cache/offlineQueue';
import { supabase } from '@/lib/supabase';
import { useSessionLogStore } from '@/stores/sessionLogStore';
import { isSessionLogEvent, type SessionLogEvent } from '@gg/shared/types/session-events';
import { SessionLogContext, type SessionLogContextValue } from './SessionLogContext';

const HYDRATION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

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
    // private-browsing / SSR — in-memory fallback
    return crypto.randomUUID();
  }
}

function persistVoiceAnchors(anchors: Map<string, VoiceAnchor>): void {
  try {
    const snapshot: Record<string, VoiceAnchor> = {};
    for (const [k, v] of anchors) snapshot[k] = v;
    sessionStorage.setItem(VOICE_ANCHORS_KEY, JSON.stringify(snapshot));
  } catch {
    // best-effort
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
    // best-effort
  }
}

export function SessionLogProvider({ children }: { children: ReactNode }) {
  const sessionIdRef = useRef<string>(readOrCreateSessionId());
  const voiceAnchorsRef = useRef<Map<string, VoiceAnchor>>(new Map());

  // Rotate on SIGNED_OUT or any user_id delta after init. Anon→login rotates
  // (prevents A→B session_id leak via shared sessionStorage). On SIGNED_IN,
  // also hydrate the local sessionLogStore from the server so a returning
  // user on a new device / cleared storage gets the recent state_delta
  // their LLM context needs.
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
          // best-effort
        }
        sessionIdRef.current = fresh;
        useSessionLogStore.getState().clear();
      }
      if (next && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        // Hydrate once per signed-in session. Already-hydrated stores skip.
        const store = useSessionLogStore.getState();
        if (!store.hydrated) {
          const sinceTs = new Date(Date.now() - HYDRATION_WINDOW_MS).toISOString();
          fetchSessionStateDelta(sinceTs)
            .then((res) => useSessionLogStore.getState().hydrate(res.state_delta))
            .catch((err) => {
              if (import.meta.env.DEV) {
                console.warn('[session-log] hydration failed', err);
              }
            });
        }
      }
      lastUserId = next;
      initialized = true;
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: SessionLogContextValue = useMemo(() => {
    // Optimistic write-ahead: assign a client UUID + timestamp now so the
    // local sessionLogStore (and any context-block builder that reads from
    // it) sees the event before the server round-trip completes. The server
    // accepts the client-provided id and dedupes via ON CONFLICT.
    const buildBody = (
      event_type: SessionLogEvent,
      payload?: Record<string, unknown>,
      screen_id?: string,
    ) => ({
      id: crypto.randomUUID(),
      session_id: sessionIdRef.current,
      timestamp: new Date().toISOString(),
      event_type,
      ...(screen_id ? { screen_id } : {}),
      ...(payload ? { payload } : {}),
    });

    const dispatch = (body: ReturnType<typeof buildBody>) => {
      // Write to local store FIRST. State delta reconstruction is now sync.
      useSessionLogStore.getState().appendEvent({
        id: body.id,
        session_id: body.session_id,
        timestamp: body.timestamp,
        event_type: body.event_type,
        screen_id: body.screen_id ?? null,
        payload: body.payload ?? null,
      });

      // Then fire the network write. The server will use our id (idempotent
      // ON CONFLICT). On success, flip sync_status; on 4xx drop; on 5xx
      // hand off to offlineQueue for retry.
      logSessionEvent(body)
        .then(() => {
          useSessionLogStore.getState().markSynced([body.id]);
        })
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
            // 4xx is unrecoverable. The local row stays pending — it won't
            // ever sync but is still usable for the current session's
            // state_delta. Acceptable: 4xx is a client bug, not a network
            // issue, and we don't want to retry forever.
            return;
          }
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
      logEvent('voice_started', { ...(extra ?? {}), voice_anchor_id: anchor_id }, screen_id);
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
  }, []);

  // Orphan recovery for tab-close mid-session
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

  // pagehide (not beforeunload) — iOS Safari. sendBeacon can't carry auth headers
  useEffect(() => {
    const onHide = () => persistVoiceAnchors(voiceAnchorsRef.current);
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  return <SessionLogContext.Provider value={value}>{children}</SessionLogContext.Provider>;
}
