/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LLMToolEvent } from '@gg/shared/types/llm';
import { useChatToolEvents } from '../useChatToolEvents';

function advanceEvt(id: string): LLMToolEvent {
  return {
    id,
    name: 'confirm_step_complete',
    args: {},
    result: { ok: true, payload: { result: { advance: true } } },
  };
}

let container: HTMLDivElement;
let root: Root;
const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

function ToolBridge(props: {
  toolEvents: LLMToolEvent[];
  resetKey: string | null;
  onAdvance: () => void;
}) {
  useChatToolEvents({
    toolEvents: props.toolEvents,
    active: true,
    routes: [],
    onVoiceAction: vi.fn(),
    onAdvance: props.onAdvance,
    resetKey: props.resetKey,
  });
  return null;
}

function render(props: { toolEvents: LLMToolEvent[]; resetKey: string | null; onAdvance: () => void }) {
  act(() => {
    root.render(
      <Wrapper>
        <ToolBridge {...props} />
      </Wrapper>,
    );
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useChatToolEvents — dedup scope (Phase 2 resetKey)', () => {
  // Stable session passes one resetKey across screens → session-scoped dedup.
  it('dedups a fired call_id across re-renders while resetKey is unchanged', () => {
    const onAdvance = vi.fn();
    render({ toolEvents: [advanceEvt('tc-1')], resetKey: 'sess', onAdvance });
    expect(onAdvance).toHaveBeenCalledTimes(1);
    // Same id re-presented (new array ref) under the same session → not re-fired.
    render({ toolEvents: [advanceEvt('tc-1')], resetKey: 'sess', onAdvance });
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  // A new screen's tool call has a globally-unique id → still advances.
  it('fires a NEW call_id even when resetKey is unchanged (session-scoped is not a block)', () => {
    const onAdvance = vi.fn();
    render({ toolEvents: [advanceEvt('tc-1')], resetKey: 'sess', onAdvance });
    render({ toolEvents: [advanceEvt('tc-2')], resetKey: 'sess', onAdvance });
    expect(onAdvance).toHaveBeenCalledTimes(2);
  });

  // Legacy passes screenId → a screen change re-arms dedup for the same id.
  it('re-arms dedup when resetKey changes (legacy per-screen behavior)', () => {
    const onAdvance = vi.fn();
    render({ toolEvents: [advanceEvt('tc-1')], resetKey: 'screen-A', onAdvance });
    expect(onAdvance).toHaveBeenCalledTimes(1);
    render({ toolEvents: [advanceEvt('tc-1')], resetKey: 'screen-B', onAdvance });
    expect(onAdvance).toHaveBeenCalledTimes(2);
  });
});
