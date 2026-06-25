/**
 * FlowOnboardingPreview — a public, auth-free render of the chat-native flow.
 *
 * Same engine and renderer as the real FlowOnboarding, but with the local
 * (in-memory) persistence adapter so the whole flow is runnable in a browser
 * without login or Supabase. Used for QA + the design walkthrough. Mounted at
 * /onboarding-flow-preview (outside the AppGate). Not a user-facing route.
 *
 * Voice runs here too (Cartesia opener + Vapi), so it is a real no-login voice
 * walk, see the seeded anonId below.
 */
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { IntroGate } from './IntroGate';
import { useLocalPersistence } from './persistence';
import { FlowRenderer } from './renderer/FlowRenderer';
import { useFlow } from './useFlow';
import { useFlowOrchestrator } from './useFlowOrchestrator';

export function FlowOnboardingPreview() {
  // No session here, so anonId is null. Vapi's live-gate requires a non-empty
  // anon_id (the backend rejects empty ones, every tool call would fail), so
  // seed a throwaway one. This lets the auth-free walk run the full Vapi path,
  // not just the Cartesia opener. A real session overwrites it on login.
  useEffect(() => {
    if (!useAuthStore.getState().anonId) {
      useAuthStore.setState({ anonId: `preview-${crypto.randomUUID()}` });
    }
  }, []);

  const { flow, tag } = useFlow(null);
  const persistence = useLocalPersistence();
  const orchestrator = useFlowOrchestrator(flow, persistence, { flowTag: tag });

  return (
    <div className="bg-background h-screen w-screen">
      <IntroGate>
        <FlowRenderer orchestrator={orchestrator} />
      </IntroGate>
    </div>
  );
}
