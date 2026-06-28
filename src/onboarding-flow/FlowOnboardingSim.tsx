/**
 * FlowOnboardingSim, voice simulator for the chat-native flow.
 *
 * Runs the real engine, renderer, and components with in-memory persistence and
 * no login. It jumps straight to the advanced brain-dump beat, then uses the
 * same BrainDumpCapture component now registered for the real onboarding flow.
 *
 * Dev: window.__simDump('go to the gym monday, no caffeine') injects a transcript
 * without a mic. window.__simStream('go to the gym', 120) replays word cadence.
 */
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { BrainDumpCapture } from './BrainDumpCapture';
import { useLocalPersistence } from './persistence';
import { FlowRenderer } from './renderer/FlowRenderer';
import type { BeatCapture, FlowNode } from './types';
import { useFlow } from './useFlow';
import { useFlowOrchestrator } from './useFlowOrchestrator';

function fastForwardCapture(node: FlowNode): BeatCapture | null {
  switch (node.componentType) {
    case 'auth':
    case 'mic-permission':
    case 'primary-button':
      return { data: {} };
    case 'profile-input':
      return { data: { age: 30, gender: 'Male' } };
    case 'path-selection':
      return { data: {}, path: 'braindump' };
    default:
      return null;
  }
}

export function FlowOnboardingSim() {
  useEffect(() => {
    if (!useAuthStore.getState().anonId) {
      useAuthStore.setState({ anonId: `sim-${crypto.randomUUID()}` });
    }
  }, []);

  const { flow, tag } = useFlow(null);
  const persistence = useLocalPersistence();
  const orchestrator = useFlowOrchestrator(flow, persistence, { flowTag: tag });
  const node = orchestrator.currentNode;

  const advancedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!node) return;
    const cap = fastForwardCapture(node);
    if (!cap) return;
    if (advancedRef.current.has(node.id)) return;
    advancedRef.current.add(node.id);
    orchestrator.capture(cap);
  }, [node, orchestrator]);

  const capture = node?.componentType === 'coach-bubble' ? (
    <BrainDumpCapture node={node} onCapture={orchestrator.capture} enableDevHooks />
  ) : null;

  return (
    <div className="bg-background flex h-screen w-screen flex-col">
      <div className="min-h-0 flex-1">
        <FlowRenderer orchestrator={orchestrator} showVoiceControls={false} afterFeed={capture} />
      </div>
    </div>
  );
}
