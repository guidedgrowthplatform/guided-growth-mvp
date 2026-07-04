/**
 * FlowOnboarding — the real chat-native onboarding entry.
 *
 * Loads the published flow (pinned to the version the user started on), wires the
 * orchestrator to the real Supabase save path, and renders the continuous chat.
 * Mount this inside the onboarding AppGate + OnboardingVoiceProvider, the same
 * way the Step pages are mounted today.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingRealtimeSync } from '@/hooks/useOnboardingRealtimeSync';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useAuthStore } from '@/stores/authStore';
import { IntroGate } from './IntroGate';
import { useOnboardingPersistence } from './persistence';
import { FlowRenderer } from './renderer/FlowRenderer';
import { preloadOpenerClips } from './renderer/openerPreloadPool';
import type { FlowAnswers } from './types';
import { useFlow } from './useFlow';
import { useFlowOrchestrator } from './useFlowOrchestrator';

export function FlowOnboarding() {
  // Vapi tool calls write onboarding_states server-side; this realtime
  // side-channel mirrors those writes into the React Query cache so the
  // orchestrator sees the current_step climb + form fields fill. The legacy
  // step pages got this via OnboardingLayout, which the chat-native engine
  // intentionally doesn't render -- so mount it directly here.
  useOnboardingRealtimeSync();
  const { state } = useOnboarding();
  // Pin a returning user to the version they started on. The read is wired now;
  // writing the tag back (onPin) lands with the flow_versions table -- see
  // useFlow.ts. Until then, unpinned users get the latest published flow.
  const pinnedTag = (state?.data as { flowVersion?: string } | undefined)?.flowVersion ?? null;
  const { flow, tag, problems } = useFlow(pinnedTag);
  const persistence = useOnboardingPersistence();

  // Warm every beat-opener clip at flow mount so playback start never rides
  // the network when a beat activates (B15). Idempotent per src.
  useEffect(() => {
    if (!flow) return;
    preloadOpenerClips(
      flow.nodes.flatMap((n) =>
        n.meta?.voiceOut?.engine === 'mp3' && n.meta.voiceOut.mp3Assets?.[0]?.file
          ? [n.meta.voiceOut.mp3Assets[0].file]
          : [],
      ),
    );
  }, [flow]);

  // The name comes from sign-in (the profile beat says "you already know it"), so
  // seed it as a known answer — the coach greets by it and never re-asks. QA accounts
  // get this stamped onto user_metadata.nickname at sign-in (QAControlScreen).
  const authNickname = useAuthStore((s) => s.user?.nickname ?? s.user?.name ?? null);
  const initialAnswers: Partial<FlowAnswers> | undefined = authNickname
    ? { nickname: authNickname }
    : undefined;

  // Seed the sign-in name to onboarding_states up front (step 1, GREATEST keeps the
  // real step) so the greeting/{name} has it before the profile beat.
  // Only a server-valid nickname (letters/digits/underscore) to avoid a 400 on spaces.
  const persistedNameRef = useRef(false);
  useEffect(() => {
    if (persistedNameRef.current) return;
    if (!authNickname || !/^[a-zA-Z0-9_]{1,50}$/.test(authNickname)) return;
    persistedNameRef.current = true;
    persistence.saveStep(1, { nickname: authNickname });
  }, [authNickname, persistence]);

  // Onboarding starts with the coach voice ON, every entry (B2). The stored
  // preference can hold 'screen' from elsewhere (home check-in's "Talk instead"
  // writes it durably; QA resets wipe onboarding rows but not preferences), and
  // the server row overrides the local default on refetch — so force it once
  // per mount instead of relying on the default. An in-session toggle-off is
  // respected (this fires once); a refresh re-enters with voice ON by design.
  const { updatePreferences } = useUserPreferences();
  const voiceOnForcedRef = useRef(false);
  useEffect(() => {
    if (voiceOnForcedRef.current) return;
    voiceOnForcedRef.current = true;
    void updatePreferences({ voiceMode: 'voice' });
  }, [updatePreferences]);

  // QA only: ?startAt=<nodeId> lets the QA screen jump into a specific beat
  // (e.g. ?startAt=profile to skip auth and mic). The orchestrator seeds the
  // machine at that node on mount. Ignored in production (no one navigates
  // to /onboarding/flow with this param outside the QA screen).
  const [searchParams] = useSearchParams();
  const startAtNodeId = searchParams.get('startAt') ?? undefined;

  const onPin = useCallback((t: string) => {
    // SEAM: persist `t` into onboarding_states.data.flowVersion so this user
    // stays on this flow version across sessions. Deferred with flow_versions.
    if (import.meta.env.DEV) console.info('[flow] pin version', t);
  }, []);

  if (problems.length && import.meta.env.DEV) {
    console.error('[flow] invalid flow document:', problems);
  }

  const orchestrator = useFlowOrchestrator(flow, persistence, {
    flowTag: tag,
    onPin,
    initialAnswers,
    startAtNodeId,
  });

  return (
    <IntroGate>
      <FlowRenderer orchestrator={orchestrator} />
    </IntroGate>
  );
}
