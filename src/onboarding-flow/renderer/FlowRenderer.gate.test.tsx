/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlowOrchestrator } from '../useFlowOrchestrator';
import { FlowRenderer } from './FlowRenderer';

vi.mock('./FlowVoiceControls', () => ({ FlowVoiceControls: () => null }));

const orchestrator = {
  flow: { flowId: 'x', name: 'x', version: 1, publishedAt: '', entryNodeId: 'a', nodes: [] },
  state: { currentNodeId: 'a', visited: [], answers: {}, status: 'running' },
  currentNode: undefined,
  answers: {},
  activeContext: null,
  capture: vi.fn(),
  back: vi.fn(),
  canGoBack: true,
  isComplete: false,
} as unknown as FlowOrchestrator;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const backButton = () => container.querySelector('button[aria-label="Back"]');

describe('FlowRenderer variant', () => {
  it('shows the back button by default (onboarding)', () => {
    act(() => root.render(createElement(FlowRenderer, { orchestrator })));
    expect(backButton()).not.toBeNull();
  });

  it('hides the back button in the overlay variant (check-in)', () => {
    act(() => root.render(createElement(FlowRenderer, { orchestrator, variant: 'overlay' })));
    expect(backButton()).toBeNull();
  });
});
