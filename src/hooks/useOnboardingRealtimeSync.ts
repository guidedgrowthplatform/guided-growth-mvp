import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { queryKeys } from '@/lib/query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { OnboardingState } from '@shared/types';

export type RealtimeSyncStatus = 'idle' | 'subscribing' | 'subscribed' | 'error';

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
          if (current?.updated_at && next.updated_at && current.updated_at > next.updated_at) {
            if (import.meta.env.DEV) {
              console.log('[realtime] dropped (stale)', next.updated_at, '<', current.updated_at);
            }
            return;
          }
          qc.setQueryData<OnboardingState | null>(queryKeys.onboarding.state, next);
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
