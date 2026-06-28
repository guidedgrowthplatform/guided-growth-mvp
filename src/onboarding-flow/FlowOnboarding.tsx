/**
 * FlowOnboarding — the real chat-native onboarding entry.
 *
 * Loads the published flow (pinned to the version the user started on), wires the
 * orchestrator to the real Supabase save path, and renders the continuous chat.
 * Mount this inside the onboarding AppGate + OnboardingVoiceProvider, the same
 * way the Step pages are mounted today.
 */
import { useCallback } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingRealtimeSync } from '@/hooks/useOnboardingRealtimeSync';
import { IntroGate } from './IntroGate';
import { useOnboardingPersistence } from './persistence';
import { FlowRenderer } from './renderer/FlowRenderer';
import { useFlow } from './useFlow';
import { useFlowOrchestrator } from './useFlowOrchestrator';

export function FlowOnboarding() {
  // Vapi tool calls write onboarding_states server-side; this realtime
  // side-channel mirrors those writes into the React Query cache so the
  // orchestrator sees the current_step climb + form fields fill. The legacy
  // step pages got this via OnboardingLayout, which the chat-native engine
  // intentionally doesn't render — so mount it directly here.
  useOnboardingRealtimeSync();
  const { state } = useOnboarding();
  // Pin a returning user to the version they started on. The read is wired now;
  // writing the tag back (onPin) lands with the flow_versions table — see
  // useFlow.ts. Until then, unpinned users get the latest published flow.
  const pinnedTag = (state?.data as { flowVersion?: string } | undefined)?.flowVersion ?? null;
  const { flow, tag, problems } = useFlow(pinnedTag);
  const persistence = useOnboardingPersistence();

  const onPin = useCallback((t: string) => {
    // SEAM: persist `t` into onboarding_states.data.flowVersion so this user
    // stays on this flow version across sessions. Deferred with flow_versions.
    if (import.meta.env.DEV) console.info('[flow] pin version', t);
  }, []);

  if (problems.length && import.meta.env.DEV) {
    console.error('[flow] invalid flow document:', problems);
  }

  const orchestrator = useFlowOrchestrator(flow, persistence, { flowTag: tag, onPin });

  return (
    <IntroGate>
      <FlowRenderer orchestrator={orchestrator} />
    </IntroGate>
  );
}
