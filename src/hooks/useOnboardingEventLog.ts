import { useEffect, useRef } from 'react';
import { debugEnabled, logDebugEvent } from '@/lib/debug/onboardingDebug';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useSessionLogStore } from '@/stores/sessionLogStore';

interface VapiToolEventPayload {
  tool: string;
  ok: boolean;
  error_code: string | null;
  call_id: string;
  args: unknown;
  ts: string;
}

// Vapi broadcasts + sessionLogStore timeline → console. The Direct-LLM stream
// is tapped in useLLM (lives in the chat provider, not here).
export function useOnboardingEventLog(): void {
  const anonId = useAuthStore((s) => s.anonId);

  // Path 1 — Vapi tool broadcasts.
  useEffect(() => {
    if (!anonId || !debugEnabled()) return;
    const channel = supabase
      .channel(`vapi-debug:${anonId}`)
      .on(
        'broadcast',
        { event: 'tool_event' },
        ({ payload }: { payload: VapiToolEventPayload }) => {
          logDebugEvent({
            source: 'vapi',
            label: payload.tool,
            ok: payload.ok,
            code: payload.error_code,
            detail: { call_id: payload.call_id, args: payload.args },
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [anonId]);

  // Shared session timeline — only events appended after mount (skip the
  // hydration backlog), keyed by id so trims/re-renders don't double-print.
  const seenRef = useRef<Set<string>>(new Set());
  const mountTsRef = useRef<string>(new Date().toISOString());
  useEffect(() => {
    if (!debugEnabled()) return;
    const seen = seenRef.current;
    const mountTs = mountTsRef.current;
    const handle = (
      events: {
        id: string;
        event_type: string;
        screen_id: string | null;
        timestamp: string;
        payload: Record<string, unknown> | null;
      }[],
    ) => {
      for (const e of events) {
        if (seen.has(e.id) || e.timestamp < mountTs) continue;
        seen.add(e.id);
        logDebugEvent({
          source: 'session',
          label: `${e.event_type}${e.screen_id ? ` → ${e.screen_id}` : ''}`,
          detail: e.payload ?? undefined,
        });
      }
    };
    handle(useSessionLogStore.getState().events);
    return useSessionLogStore.subscribe((s) => handle(s.events));
  }, []);
}
