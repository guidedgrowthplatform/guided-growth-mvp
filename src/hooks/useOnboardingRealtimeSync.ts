import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { queryKeys } from '@/lib/query';
import { supabase } from '@/lib/supabase';
import { markBeatTransition } from '@/lib/telemetry/latencySpans';
import { useAuthStore } from '@/stores/authStore';
import type { OnboardingState } from '@gg/shared/types';

export type RealtimeSyncStatus = 'idle' | 'subscribing' | 'subscribed' | 'error';

/**
 * Out-of-order Realtime delivery can echo an OLDER row after a fresh save.
 * Drop the incoming row only when we can PROVE it is older: both sides carry a
 * comparable `updated_at` and the current one is strictly newer.
 *
 * This guard only works if every saved row actually carries `updated_at`. The
 * PUT save handler must include `updated_at` (and `created_at`) in its RETURNING
 * clause; otherwise the just-saved cache row has `updated_at === undefined`, the
 * comparison short-circuits to "not stale", and a late echo of the pre-save row
 * silently clobbers fresh state. Tested against both shapes below.
 *
 * Compare by parsed epoch, NOT lexically: the API PUT returns ISO-8601
 * (`2026-...T10:00:00.123Z`) while Supabase Realtime delivers the Postgres
 * space form (`2026-... 10:00:00.123456+00`). A string `>` sorts `' '`(0x20)
 * below `'T'`(0x54), so a realtime echo would always read as "older" than a
 * just-saved ISO row and get dropped. Date.parse normalizes both.
 */
export function isStaleRealtimeRow(
  current: { updated_at?: string | null } | null | undefined,
  next: { updated_at?: string | null },
): boolean {
  if (!current?.updated_at || !next.updated_at) return false;
  const c = Date.parse(current.updated_at);
  const n = Date.parse(next.updated_at);
  if (Number.isNaN(c) || Number.isNaN(n)) return false;
  return c > n;
}

/**
 * Apply a passed-the-guard realtime row onto the cached row. `current_step` and
 * other scalars take the incoming (newest-by-timestamp) value — back-nav via
 * navigate_next to a lower step must still take effect. `data` is UNIONED so a
 * write that touched only one column (e.g. navigate_next bumping current_step)
 * can never drop a field a concurrent split-write just added. The backend
 * transaction (one coalesced event per tool batch) is the primary fix; this is
 * defense-in-depth for any non-coalesced write.
 */
export function mergeRealtimeRow(
  current: OnboardingState | null | undefined,
  next: OnboardingState,
): OnboardingState {
  if (!current) return next;
  return {
    ...next,
    data: { ...(current.data ?? {}), ...(next.data ?? {}) },
  };
}

/**
 * Subscribe to the authenticated user's `onboarding_states` row via
 * Supabase Realtime and mirror changes into the React Query cache.
 *
 * Why this hook exists
 * --------------------
 * The Cartesia agent WebSocket carries audio only. It does not forward
 * tool-call events to the browser (verified against
 * https://github.com/cartesia-ai/agent-ws-example — server → client events
 * are limited to `ack`, `media_output`, `clear`, `transfer_call`). So when
 * the agent calls a tool like `record_onboarding_profile`, the only way
 * the UI observes the update is through a side channel. We use Supabase
 * Realtime because the agent writes its result straight to
 * `onboarding_states.data`.
 *
 * On an event we push the new row directly into the same React Query
 * entry that `useOnboarding()` reads from, so consumers that already
 * drive their form state off `onboardingState.data` pick up the change
 * without a refetch.
 */
export function useOnboardingRealtimeSync(): RealtimeSyncStatus {
  const qc = useQueryClient();
  const anonId = useAuthStore((s) => s.anonId);
  const [status, setStatus] = useState<RealtimeSyncStatus>('idle');

  useEffect(() => {
    if (!anonId) {
      setStatus('idle');
      return;
    }

    setStatus('subscribing');
    const channel = supabase
      .channel(`onboarding-states:${anonId}`)
      .on(
        // @ts-expect-error — supabase-js types lag behind the runtime API
        // for postgres_changes; the call works at runtime.
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'onboarding_states',
          filter: `anon_id=eq.${anonId}`,
        },
        (payload: { new?: OnboardingState | null; eventType?: string }) => {
          if (import.meta.env.DEV) {
            console.log('[realtime] onboarding_states event', payload.eventType, payload.new);
          }
          const next = payload.new ?? null;
          if (!next) return;
          // RLS already scopes delivery; drop any foreign row as defense-in-depth.
          if (next.anon_id !== anonId) return;
          // Guard against out-of-order Realtime delivery clobbering the
          // cache with a stale row. `onboarding_states.updated_at` is bumped
          // by the API on every write (Alembic trigger) so strict `>` is
          // safe.
          const current = qc.getQueryData<OnboardingState | null>(queryKeys.onboarding.state);
          if (isStaleRealtimeRow(current, next)) {
            if (import.meta.env.DEV) {
              console.log('[realtime] dropped (stale)', next.updated_at, '<', current?.updated_at);
            }
            return;
          }
          // Latency lane T1: a row that climbs current_step past the cached one
          // is the Vapi-path trigger leg of beat_transition_ms (server tool
          // write -> Realtime receipt -> orchestrator advance). Marked before
          // the cache write settles into the orchestrator effect. Measurement
          // only; initial hydration (no cached row) is not a transition.
          if (
            typeof current?.current_step === 'number' &&
            typeof next.current_step === 'number' &&
            next.current_step > current.current_step
          ) {
            markBeatTransition(`rt:${next.updated_at ?? next.current_step}`, 'realtime');
          }
          qc.setQueryData<OnboardingState | null>(queryKeys.onboarding.state, (cur) =>
            mergeRealtimeRow(cur, next),
          );
          if (import.meta.env.DEV) {
            console.log('[realtime] cache updated → data:', next.data);
          }
        },
      )
      .subscribe((channelStatus) => {
        if (channelStatus === 'SUBSCRIBED') setStatus('subscribed');
        else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') {
          setStatus('error');
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [anonId, qc]);

  return status;
}
