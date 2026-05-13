/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { useContext, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { onAuthStateChangeMock, logSessionEventMock } = vi.hoisted(() => ({
  onAuthStateChangeMock: vi.fn(),
  logSessionEventMock: vi.fn().mockResolvedValue({ id: 'x', timestamp: '' }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: onAuthStateChangeMock } },
  sessionReady: Promise.resolve(),
}));

vi.mock('@/api/sessionLog', () => ({
  logSessionEvent: logSessionEventMock,
}));

vi.mock('@/cache/offlineQueue', () => ({
  offlineQueue: { enqueue: vi.fn() },
}));

import { SessionLogContext, type SessionLogContextValue } from '../SessionLogContext';
import { SessionLogProvider } from '../SessionLogProvider';

interface AuthChangeHandler {
  (event: string, session: { user: { id: string } } | null): void;
}

let capturedHandler: AuthChangeHandler | null = null;
let container: HTMLDivElement;
let root: Root;
let ctxRef: SessionLogContextValue | null = null;

function Bridge() {
  const ctx = useContext(SessionLogContext);
  ctxRef = ctx;
  return null;
}

function mount(node?: ReactNode) {
  act(() => {
    root.render(<SessionLogProvider>{node ?? <Bridge />}</SessionLogProvider>);
  });
}

function fire(event: string, userId: string | null) {
  act(() => {
    capturedHandler!(event, userId ? { user: { id: userId } } : null);
  });
}

beforeEach(() => {
  onAuthStateChangeMock.mockReset();
  onAuthStateChangeMock.mockImplementation((handler: AuthChangeHandler) => {
    capturedHandler = handler;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  // jsdom provides sessionStorage; clear between tests.
  sessionStorage.clear();
  capturedHandler = null;
  ctxRef = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  try {
    act(() => root.unmount());
  } catch {
    // already unmounted
  }
  container.remove();
});

describe('SessionLogProvider — session_id rotation', () => {
  it('rotates session_id on SIGNED_OUT', () => {
    mount();
    const initial = ctxRef!.sessionId;
    fire('INITIAL_SESSION', 'user-A');
    expect(ctxRef!.sessionId).toBe(initial);

    fire('SIGNED_OUT', null);
    expect(ctxRef!.sessionId).not.toBe(initial);
  });

  it('rotates session_id on A→B handoff (SIGNED_OUT then SIGNED_IN as different user)', () => {
    mount();
    fire('INITIAL_SESSION', 'user-A');
    const afterA = ctxRef!.sessionId;

    fire('SIGNED_OUT', null);
    const afterSignOut = ctxRef!.sessionId;
    expect(afterSignOut).not.toBe(afterA);

    fire('SIGNED_IN', 'user-B');
    expect(ctxRef!.sessionId).not.toBe(afterSignOut);
    expect(ctxRef!.sessionId).not.toBe(afterA);
  });

  it('does NOT rotate on TOKEN_REFRESHED with same user id', () => {
    mount();
    fire('INITIAL_SESSION', 'user-A');
    const before = ctxRef!.sessionId;

    fire('TOKEN_REFRESHED', 'user-A');
    expect(ctxRef!.sessionId).toBe(before);

    fire('USER_UPDATED', 'user-A');
    expect(ctxRef!.sessionId).toBe(before);
  });

  it('does NOT rotate on cold-boot INITIAL_SESSION (first event)', () => {
    mount();
    const initial = ctxRef!.sessionId;

    fire('INITIAL_SESSION', 'user-A');
    expect(ctxRef!.sessionId).toBe(initial);
  });

  it('rotates on anon→login (null lastUserId → first SIGNED_IN)', () => {
    mount();
    fire('INITIAL_SESSION', null);
    const anon = ctxRef!.sessionId;

    fire('SIGNED_IN', 'user-A');
    expect(ctxRef!.sessionId).not.toBe(anon);
  });
});
