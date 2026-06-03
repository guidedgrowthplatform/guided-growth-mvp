/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { track } from '@/analytics';
import type { LastCreatedItem } from '@/lib/chat/coachChatTypes';
import type { LLMChatMessage, LLMToolEvent } from '@gg/shared/types/llm';
import { useCoachChatToolEvents } from '../useCoachChatToolEvents';

vi.mock('@/analytics', () => ({ track: vi.fn() }));
const trackMock = track as unknown as ReturnType<typeof vi.fn>;

function toolEvt(
  id: string,
  name: string,
  ok = true,
  args: Record<string, unknown> = {},
): LLMToolEvent {
  return { id, name, args, result: { ok, payload: { result: {} } } };
}

function assistant(id: string, toolEvents: LLMToolEvent[]): LLMChatMessage {
  return { id, role: 'assistant', content: 'ok', toolEvents };
}

let lastCreatedRef: LastCreatedItem | undefined;

function Bridge(props: {
  messages: LLMChatMessage[];
  resetKey: string | null;
  initialMessages: LLMChatMessage[];
}) {
  lastCreatedRef = useCoachChatToolEvents(props.messages, props.resetKey, props.initialMessages);
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
  lastCreatedRef = undefined;
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

  it('forwards an ok tool event to the funnel tracker once', () => {
    render({
      messages: [assistant('m1', [toolEvt('e1', 'create_habit', true, { name: 'Meditate' })])],
      resetKey: 'sess-A',
      initialMessages: [],
    });
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock.mock.calls[0][0]).toBe('create_habit');
  });

  it('does not fire a funnel event on a failed result', () => {
    render({
      messages: [assistant('m1', [toolEvt('e1', 'create_habit', false)])],
      resetKey: 'sess-A',
      initialMessages: [],
    });
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('does not re-fire funnel events for a resumed thread', () => {
    const resumed = [assistant('m1', [toolEvt('e1', 'create_habit', true, { name: 'x' })])];
    render({ messages: resumed, resetKey: 'sess-A', initialMessages: resumed });
    expect(trackMock).not.toHaveBeenCalled();
  });

  // Real wire shape: useLLM.ts:129 sets result = { ok, payload: e.result } and
  // the server's ok() helper already wraps as { ok: true, result: {...} }, so
  // the habit id lives at payload.result.habit.id — same depth coachChatCards reads.
  it('captures lastCreatedItem from a create_habit tool result', () => {
    const evt: LLMToolEvent = {
      id: 'e1',
      name: 'create_habit',
      args: { name: 'Meditate' },
      result: {
        ok: true,
        payload: { ok: true, result: { created: true, habit: { id: 'h-123', name: 'Meditate' } } },
      },
    };
    render({
      messages: [assistant('m1', [evt])],
      resetKey: 'sess-A',
      initialMessages: [],
    });
    expect(lastCreatedRef).toEqual({ type: 'habit', id: 'h-123' });
  });

  it('captures lastCreatedItem from a log_reflection tool result', () => {
    const evt: LLMToolEvent = {
      id: 'e1',
      name: 'log_reflection',
      args: {},
      result: {
        ok: true,
        payload: { ok: true, result: { logged: true, entry_id: 'r-9', date: '2026-06-02' } },
      },
    };
    render({
      messages: [assistant('m1', [evt])],
      resetKey: 'sess-A',
      initialMessages: [],
    });
    expect(lastCreatedRef).toEqual({ type: 'reflection', id: 'r-9' });
  });

  it('keeps the latest created item across multiple creates in a session', () => {
    const e1: LLMToolEvent = {
      id: 'e1',
      name: 'create_habit',
      args: {},
      result: { ok: true, payload: { ok: true, result: { habit: { id: 'h-1' } } } },
    };
    const e2: LLMToolEvent = {
      id: 'e2',
      name: 'log_reflection',
      args: {},
      result: { ok: true, payload: { ok: true, result: { entry_id: 'r-2' } } },
    };
    render({
      messages: [assistant('m1', [e1, e2])],
      resetKey: 'sess-A',
      initialMessages: [],
    });
    expect(lastCreatedRef).toEqual({ type: 'reflection', id: 'r-2' });
  });

  it('does not capture lastCreatedItem for non-create tools', () => {
    const evt: LLMToolEvent = {
      id: 'e1',
      name: 'complete_habit',
      args: {},
      result: { ok: true, payload: { ok: true, result: {} } },
    };
    render({
      messages: [assistant('m1', [evt])],
      resetKey: 'sess-A',
      initialMessages: [],
    });
    expect(lastCreatedRef).toBeUndefined();
  });

  it('does not capture lastCreatedItem when the create result is not ok', () => {
    const evt: LLMToolEvent = {
      id: 'e1',
      name: 'create_habit',
      args: {},
      result: { ok: false, payload: { ok: false, result: {} } },
    };
    render({
      messages: [assistant('m1', [evt])],
      resetKey: 'sess-A',
      initialMessages: [],
    });
    expect(lastCreatedRef).toBeUndefined();
  });

  // Regression guard: the old shallow shape (payload.habit, no result wrapper)
  // must NOT be picked up — that was the bug Mint caught.
  it('rejects the old shallow shape with payload.habit at depth 1', () => {
    const evt: LLMToolEvent = {
      id: 'e1',
      name: 'create_habit',
      args: {},
      result: { ok: true, payload: { habit: { id: 'h-wrong' } } },
    };
    render({
      messages: [assistant('m1', [evt])],
      resetKey: 'sess-A',
      initialMessages: [],
    });
    expect(lastCreatedRef).toBeUndefined();
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
