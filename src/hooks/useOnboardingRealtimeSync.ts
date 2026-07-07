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
 * Data-provenance guard for the "empty cache" case (fresh page load, or a
 * cache just cleared by a DELETE event handled inline in
 * `useOnboardingRealtimeSync` below).
 *
 * `isStaleRealtimeRow` only rejects a row when there is a CACHED `updated_at`
 * to compare against. On a genuinely empty cache it always returns `false`
 * ("not stale"), so the very first incoming Realtime event used to be
 * accepted unconditionally, however old. That is exactly how a buffered or
 * in-flight echo from a PRIOR session's real writes (same anon_id channel,
 * e.g. right after a QA reset re-subscribes) could land in a brand new
 * session and be mistaken for live data.
 *
 * The fix: when the cache is empty, a row can only be a legitimate
 * consequence of THIS session if it was written at-or-after the moment this
 * hook subscribed. Anything timestamped strictly before that instant cannot
 * have been caused by anything this session did, so it is provenance-stale
 * and must be dropped. A row timestamped at-or-after `subscribedAt` is kept
 * — this is what lets a genuinely fresh write that raced ahead of the
 * initial `useAppGate` fetch land correctly (Realtime delivering before the
 * REST fetch resolves is a normal, not a stale, race).
 *
 * Uses `updated_at` when present, falling back to `created_at` for a
 * brand-new INSERT row that has not been updated since creation.
 */
export function isProvenanceStaleOnEmptyCache(
  next: { updated_at?: string | null; created_at?: string | null },
  subscribedAt: number,
): boolean {
  const stamp = next.updated_at ?? next.created_at;
  if (!stamp) return false; // never drop on uncertainty
  const n = Date.parse(stamp);
  if (Number.isNaN(n)) return false;
  return n < subscribedAt;
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
    // Data-provenance anchor for `isProvenanceStaleOnEmptyCache`: nothing
    // this session subscribes to can legitimately be older than the moment
    // it started listening. Captured once per (re)subscribe, before any
    // event can arrive.
    const subscribedAt = Date.now();
    const channel = supabase
      .channel(`onboarding-states:${anonId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'onboarding_states',
          filter: `anon_id=eq.${anonId}`,
        },
        (payload: {
          new?: OnboardingState | Record<string, never> | null;
          old?: Partial<OnboardingState> | null;
          eventType?: string;
        }) => {
          if (import.meta.env.DEV) {
            console.log('[realtime] onboarding_states event', payload.eventType, payload.new);
          }
          // A real DELETE (the QA self-reset flow, or any future reset path)
          // carries `new: {}` per the Supabase Realtime contract, NOT `null`
          // — so a bare `if (!next) return` never actually detects it (an
          // empty object is truthy). Left undetected, the row that used to
          // live in the cache keeps being treated as current, and a stale
          // echo arriving afterward on the same channel gets compared
          // against data that the server has already wiped. Clear the cache
          // so the wipe is observed, then stop: there is nothing to merge.
          if (payload.eventType === 'DELETE') {
            qc.setQueryData(queryKeys.onboarding.state, null);
            if (import.meta.env.DEV) {
              console.log('[realtime] row deleted, cache cleared');
            }
            return;
          }
          const next = (payload.new ?? null) as OnboardingState | null;
          if (!next || !('anon_id' in next)) return;
          // RLS already scopes delivery; drop any foreign row as defense-in-depth.
          if (next.anon_id !== anonId) return;
          const current = qc.getQueryData<OnboardingState | null>(queryKeys.onboarding.state);
          if (current) {
            // Guard against out-of-order Realtime delivery clobbering the
            // cache with a stale row. `onboarding_states.updated_at` is bumped
            // by the API on every write (Alembic trigger) so strict `>` is
            // safe.
            if (isStaleRealtimeRow(current, next)) {
              if (import.meta.env.DEV) {
                console.log(
                  '[realtime] dropped (stale)',
                  next.updated_at,
                  '<',
                  current?.updated_at,
                );
              }
              return;
            }
          } else if (isProvenanceStaleOnEmptyCache(next, subscribedAt)) {
            // No cached row to compare `updated_at` against (fresh page load,
            // or the cache was just cleared by a DELETE above). Without this
            // check the FIRST event on an empty cache used to be accepted
            // unconditionally, however old — exactly how a buffered echo of a
            // PRIOR session's real writes on the same anon_id channel could
            // be mistaken for this session's live data. A row timestamped
            // before we subscribed cannot be a consequence of anything this
            // session did, so it is dropped; the initial `useAppGate` fetch
            // (not Realtime) is the source of truth for pre-existing state.
            if (import.meta.env.DEV) {
              console.log(
                '[realtime] dropped (provenance-stale on empty cache)',
                next.updated_at ?? next.created_at,
                '<',
                new Date(subscribedAt).toISOString(),
              );
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
