/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/query';
import type { OnboardingState } from '@gg/shared/types';
import type { LLMToolEvent } from '@gg/shared/types/llm';
import { useChatToolEvents } from '../useChatToolEvents';

// confirm_step_complete shape after useLLM wraps the server result under .payload;
// current_step drives the optimistic cache bump (real + server-synthetic events).
function advanceEvt(id: string, currentStep: number): LLMToolEvent {
  return {
    id,
    name: 'confirm_step_complete',
    args: {},
    result: {
      ok: true,
      payload: { ok: true, result: { advance: true, current_step: currentStep } },
    },
  };
}

let container: HTMLDivElement;
let root: Root;
let qc: QueryClient;

function seedState(currentStep: number) {
  qc.setQueryData<OnboardingState | null>(queryKeys.onboarding.state, {
    current_step: currentStep,
    data: {},
    path: null,
  } as unknown as OnboardingState);
}

function cachedStep(): number | undefined {
  return qc.getQueryData<OnboardingState | null>(queryKeys.onboarding.state)?.current_step;
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

function ToolBridge(props: { toolEvents: LLMToolEvent[]; resetKey: string | null }) {
  useChatToolEvents({
    toolEvents: props.toolEvents,
    active: true,
    routes: [],
    onVoiceAction: vi.fn(),
    resetKey: props.resetKey,
  });
  return null;
}

function render(props: { toolEvents: LLMToolEvent[]; resetKey: string | null }) {
  act(() => {
    root.render(
      <Wrapper>
        <ToolBridge {...props} />
      </Wrapper>,
    );
  });
}

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useChatToolEvents — confirm advance bumps the cache', () => {
  it('merges current_step from a confirm_step_complete advance event', () => {
    seedState(1);
    render({ toolEvents: [advanceEvt('tc-1', 2)], resetKey: 'sess' });
    expect(cachedStep()).toBe(2);
  });
});

describe('useChatToolEvents — dedup scope (Phase 2 resetKey)', () => {
  // Stable session passes one resetKey across screens → session-scoped dedup.
  it('dedups a fired call_id across re-renders while resetKey is unchanged', () => {
    seedState(1);
    render({ toolEvents: [advanceEvt('tc-1', 2)], resetKey: 'sess' });
    expect(cachedStep()).toBe(2);
    // Same id re-presented with a higher step → skipped, no further merge.
    render({ toolEvents: [advanceEvt('tc-1', 3)], resetKey: 'sess' });
    expect(cachedStep()).toBe(2);
  });

  // A new screen's tool call has a globally-unique id → still merges.
  it('fires a NEW call_id even when resetKey is unchanged (session-scoped is not a block)', () => {
    seedState(1);
    render({ toolEvents: [advanceEvt('tc-1', 2)], resetKey: 'sess' });
    render({ toolEvents: [advanceEvt('tc-2', 3)], resetKey: 'sess' });
    expect(cachedStep()).toBe(3);
  });

  // Legacy passes screenId → a screen change re-arms dedup for the same id.
  it('re-arms dedup when resetKey changes (legacy per-screen behavior)', () => {
    seedState(1);
    render({ toolEvents: [advanceEvt('tc-1', 2)], resetKey: 'screen-A' });
    expect(cachedStep()).toBe(2);
    render({ toolEvents: [advanceEvt('tc-1', 3)], resetKey: 'screen-B' });
    expect(cachedStep()).toBe(3);
  });
});
