/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { LLMChatMessage, LLMToolEvent } from '@shared/types/llm';
import { useCoachChatToolEvents } from '../useCoachChatToolEvents';

function toolEvt(id: string, name: string, ok = true): LLMToolEvent {
  return { id, name, args: {}, result: { ok, payload: { result: {} } } };
}

function assistant(id: string, toolEvents: LLMToolEvent[]): LLMChatMessage {
  return { id, role: 'assistant', content: 'ok', toolEvents };
}

function Bridge(props: {
  messages: LLMChatMessage[];
  resetKey: string | null;
  initialMessages: LLMChatMessage[];
}) {
  useCoachChatToolEvents(props.messages, props.resetKey, props.initialMessages);
  return null;
}

let container: HTMLDivElement;
let root: Root;
let qc: QueryClient;
let invalidateSpy: MockInstance;
let habitsChanged: ReturnType<typeof vi.fn>;

function render(props: {
  messages: LLMChatMessage[];
  resetKey: string | null;
  initialMessages: LLMChatMessage[];
}) {
  act(() => {
    root.render(createElement(QueryClientProvider, { client: qc }, createElement(Bridge, props)));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient();
  invalidateSpy = vi.spyOn(qc, 'invalidateQueries').mockImplementation(() => Promise.resolve());
  habitsChanged = vi.fn();
  window.addEventListener('habits-changed', habitsChanged);
});

afterEach(() => {
  window.removeEventListener('habits-changed', habitsChanged);
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('useCoachChatToolEvents', () => {
  it('invalidates caches + dispatches habits-changed on an ok mutation event', () => {
    render({
      messages: [assistant('m1', [toolEvt('e1', 'create_habit')])],
      resetKey: 'sess-A',
      initialMessages: [],
    });
    expect(habitsChanged).toHaveBeenCalledTimes(1);
    // 6 query keys invalidated per mutation pass.
    expect(invalidateSpy).toHaveBeenCalledTimes(6);
  });

  it('does not re-fire for an already-seen event id on re-render', () => {
    const messages = [assistant('m1', [toolEvt('e1', 'create_habit')])];
    render({ messages, resetKey: 'sess-A', initialMessages: [] });
    // Re-render with a fresh array carrying the same event id.
    render({
      messages: [assistant('m1', [toolEvt('e1', 'create_habit')])],
      resetKey: 'sess-A',
      initialMessages: [],
    });
    expect(habitsChanged).toHaveBeenCalledTimes(1);
  });

  it('ignores read-only tools', () => {
    render({
      messages: [assistant('m1', [toolEvt('e1', 'get_summary'), toolEvt('e2', 'query_habits')])],
      resetKey: 'sess-A',
      initialMessages: [],
    });
    expect(habitsChanged).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('ignores a failed mutation result', () => {
    render({
      messages: [assistant('m1', [toolEvt('e1', 'create_habit', false)])],
      resetKey: 'sess-A',
      initialMessages: [],
    });
    expect(habitsChanged).not.toHaveBeenCalled();
  });

  it('invalidates on a mixed message when at least one mutation event is ok', () => {
    render({
      messages: [
        assistant('m1', [toolEvt('e1', 'create_habit', false), toolEvt('e2', 'complete_habit')]),
      ],
      resetKey: 'sess-A',
      initialMessages: [],
    });
    expect(habitsChanged).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledTimes(6);
  });

  it('pre-seeds from initialMessages so a resumed thread does not re-invalidate', () => {
    const resumed = [assistant('m1', [toolEvt('e1', 'create_habit')])];
    render({ messages: resumed, resetKey: 'sess-A', initialMessages: resumed });
    expect(habitsChanged).not.toHaveBeenCalled();
  });

  it('fires again for a new session after resetKey changes', () => {
    render({
      messages: [assistant('m1', [toolEvt('e1', 'create_habit')])],
      resetKey: 'sess-A',
      initialMessages: [],
    });
    expect(habitsChanged).toHaveBeenCalledTimes(1);
    // New session, same event-id reused — reset clears dedup so it fires again.
    render({
      messages: [assistant('m2', [toolEvt('e1', 'create_habit')])],
      resetKey: 'sess-B',
      initialMessages: [],
    });
    expect(habitsChanged).toHaveBeenCalledTimes(2);
  });
});
