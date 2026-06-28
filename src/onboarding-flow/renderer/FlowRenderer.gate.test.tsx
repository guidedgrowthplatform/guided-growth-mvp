/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlowOrchestrator } from '../useFlowOrchestrator';
import { FlowRenderer } from './FlowRenderer';

const orbSpy = vi.fn();
vi.mock('./FlowVoiceControls', () => ({
  FlowVoiceControls: () => {
    orbSpy();
    return null;
  },
}));

const orchestrator = {
  flow: { flowId: 'x', name: 'x', version: 1, publishedAt: '', entryNodeId: 'a', nodes: [] },
  state: { currentNodeId: 'a', visited: [], answers: {}, status: 'running' },
  currentNode: undefined,
  answers: {},
  activeContext: null,
  capture: vi.fn(),
  back: vi.fn(),
  canGoBack: false,
  isComplete: false,
} as unknown as FlowOrchestrator;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // jsdom lacks scrollIntoView, which FlowRenderer's keep-in-view effect calls.
  Element.prototype.scrollIntoView = vi.fn();
  orbSpy.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('FlowRenderer showVoiceControls gate', () => {
  it('omits the voice orb when showVoiceControls=false (tap-only check-in)', () => {
    act(() => root.render(createElement(FlowRenderer, { orchestrator, showVoiceControls: false })));
    expect(orbSpy).not.toHaveBeenCalled();
  });

  it('renders the voice orb by default (onboarding unchanged)', () => {
    act(() => root.render(createElement(FlowRenderer, { orchestrator })));
    expect(orbSpy).toHaveBeenCalled();
  });
});
