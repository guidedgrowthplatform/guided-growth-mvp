/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatSession, type UseChatSessionReturn } from '../useChatSession';

const createOrResumeChatSession = vi.fn();
vi.mock('@/api/chat', () => ({
  createOrResumeChatSession: (screenId: string) => createOrResumeChatSession(screenId),
}));

// Authenticated user so the hook fires its fetch.
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'user-1' } }),
}));

let hookRef: UseChatSessionReturn | null = null;
function Bridge({ screenId, enabled }: { screenId: string; enabled?: boolean }) {
  const v = useChatSession(screenId, enabled === undefined ? undefined : { enabled });
  useEffect(() => {
    hookRef = v;
  });
  return null;
}

let container: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  hookRef = null;
  createOrResumeChatSession.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  try {
    act(() => root.unmount());
  } catch {
    // ignore
  }
  container.remove();
  vi.restoreAllMocks();
});

describe('useChatSession', () => {
  it('fetches the session from the server and exposes id + history', async () => {
    createOrResumeChatSession.mockResolvedValue({
      chat_session_id: 'sess-1',
      messages: [{ id: 'm1', role: 'user', content: 'hi' }],
    });

    act(() => {
      root.render(<Bridge screenId="ONBOARD-01" />);
    });
    await flush();

    expect(hookRef!.status).toBe('ready');
    expect(hookRef!.chatSessionId).toBe('sess-1');
    expect(hookRef!.initialMessages).toHaveLength(1);
  });

  it('never touches localStorage or sessionStorage', async () => {
    const localSet = vi.spyOn(Storage.prototype, 'setItem');
    createOrResumeChatSession.mockResolvedValue({ chat_session_id: 'sess-2', messages: [] });

    act(() => {
      root.render(<Bridge screenId="ONBOARD-02" />);
    });
    await flush();

    expect(localSet).not.toHaveBeenCalled();
  });

  it('enabled:false → idle, no POST', async () => {
    createOrResumeChatSession.mockResolvedValue({ chat_session_id: 'x', messages: [] });

    act(() => {
      root.render(<Bridge screenId="ONBOARD-04" enabled={false} />);
    });
    await flush();

    expect(hookRef!.status).toBe('idle');
    expect(hookRef!.chatSessionId).toBeNull();
    expect(createOrResumeChatSession).not.toHaveBeenCalled();
  });

  it('toggling enabled false→true fires the POST', async () => {
    createOrResumeChatSession.mockResolvedValue({ chat_session_id: 'sess-flip', messages: [] });

    act(() => {
      root.render(<Bridge screenId="ONBOARD-05" enabled={false} />);
    });
    await flush();
    expect(createOrResumeChatSession).not.toHaveBeenCalled();

    act(() => {
      root.render(<Bridge screenId="ONBOARD-05" enabled={true} />);
    });
    await flush();

    expect(createOrResumeChatSession).toHaveBeenCalledTimes(1);
    expect(hookRef!.status).toBe('ready');
    expect(hookRef!.chatSessionId).toBe('sess-flip');
  });

  it('unmount during fetch does not throw', async () => {
    let resolveFn!: (v: { chat_session_id: string; messages: [] }) => void;
    createOrResumeChatSession.mockReturnValue(
      new Promise((r) => {
        resolveFn = r;
      }),
    );

    act(() => {
      root.render(<Bridge screenId="ONBOARD-06" />);
    });
    await flush();

    act(() => root.unmount());
    resolveFn({ chat_session_id: 'late', messages: [] });
    await flush();
  });

  it('surfaces error status when the request fails', async () => {
    createOrResumeChatSession.mockRejectedValue(new Error('boom'));

    act(() => {
      root.render(<Bridge screenId="ONBOARD-03" />);
    });
    await flush();

    expect(hookRef!.status).toBe('error');
    expect(hookRef!.chatSessionId).toBeNull();
  });
});
