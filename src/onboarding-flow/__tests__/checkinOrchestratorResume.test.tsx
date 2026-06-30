/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { morningCheckinV1 } from '../flows/checkin-flows';
import type { FlowPersistence } from '../persistence';
import { useFlowOrchestrator, type FlowOrchestrator } from '../useFlowOrchestrator';

// User past onboarding: a high current_step that would fast-forward a synced flow.
vi.mock('@/hooks/useOnboarding', () => ({
  useOnboarding: () => ({ state: { current_step: 99, data: {} } }),
}));
vi.mock('@/contexts/useOnboardingVoiceSession', () => ({
  useOnboardingVoice: () => null,
}));

const persistence: FlowPersistence = {
  saveStep: vi.fn(),
  complete: vi.fn(),
  saveTool: vi.fn(),
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount(serverSync: boolean): () => FlowOrchestrator {
  let latest!: FlowOrchestrator;
  function Bridge() {
    latest = useFlowOrchestrator(morningCheckinV1, persistence, { serverSync });
    return null;
  }
  act(() => root.render(createElement(Bridge)));
  return () => latest;
}

describe('check-in orchestrator vs onboarding current_step', () => {
  it('serverSync:false stays at the entry beat (no resume to the end)', () => {
    const get = mount(false);
    expect(get().state.currentNodeId).toBe(morningCheckinV1.entryNodeId);
    expect(get().isComplete).toBe(false);
  });

  it('serverSync:true would resume past the entry beat (proves the gate matters)', () => {
    const get = mount(true);
    expect(get().state.currentNodeId).not.toBe(morningCheckinV1.entryNodeId);
  });
});
