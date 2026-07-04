/**
 * FlowCheckinPreview — auth-free QA preview for check-in flows.
 *
 * Mirrors FlowOnboardingPreview but accepts a FlowDocument prop so the
 * morning and evening check-in flows can each be previewed without a login.
 * Uses local (in-memory) persistence so no Supabase writes happen, exactly
 * like the existing onboarding preview. Gated inside the QA_SCREEN_ENABLED
 * block in routes/index.tsx.
 *
 * NO EM DASHES.
 */
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { type FlowPersistence, useLocalPersistence } from './persistence';
import { FlowRenderer } from './renderer/FlowRenderer';
import type { FlowDocument } from './types';
import { useFlowOrchestrator } from './useFlowOrchestrator';

interface FlowCheckinPreviewProps {
  flow: FlowDocument;
  /** Adapter override (e.g. the real check-in save path); defaults to in-memory. */
  persistence?: FlowPersistence;
}

export function FlowCheckinPreview({ flow, persistence }: FlowCheckinPreviewProps) {
  // Seed a throwaway anonId so Vapi tool calls do not fail in preview mode.
  // Real sessions overwrite this on sign-in.
  useEffect(() => {
    if (!useAuthStore.getState().anonId) {
      useAuthStore.setState({ anonId: `preview-${crypto.randomUUID()}` });
    }
  }, []);

  const localPersistence = useLocalPersistence();
  const orchestrator = useFlowOrchestrator(flow, persistence ?? localPersistence);

  return (
    <div className="bg-background h-screen w-screen">
      <FlowRenderer orchestrator={orchestrator} />
    </div>
  );
}
