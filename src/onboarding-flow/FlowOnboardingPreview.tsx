/**
 * FlowOnboardingPreview — a public, auth-free render of the chat-native flow.
 *
 * Same engine and renderer as the real FlowOnboarding, but with the local
 * (in-memory) persistence adapter so the whole flow is runnable in a browser
 * without login or Supabase. Used for QA + the design walkthrough. Mounted at
 * /onboarding-flow-preview (outside the AppGate). Not a user-facing route.
 */
import { useLocalPersistence } from './persistence';
import { FlowRenderer } from './renderer/FlowRenderer';
import { useFlow } from './useFlow';
import { useFlowOrchestrator } from './useFlowOrchestrator';

export function FlowOnboardingPreview() {
  const { flow, tag } = useFlow(null);
  const persistence = useLocalPersistence();
  const orchestrator = useFlowOrchestrator(flow, persistence, { flowTag: tag });

  return (
    <div className="bg-background h-screen w-screen">
      <FlowRenderer orchestrator={orchestrator} />
    </div>
  );
}
