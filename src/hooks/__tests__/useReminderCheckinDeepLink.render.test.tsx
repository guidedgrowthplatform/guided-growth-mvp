/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SessionLogEvent, useSessionLogStore } from '@/stores/sessionLogStore';
import { useReminderCheckinDeepLink } from '../useReminderCheckinDeepLink';

const openCoachChat = vi.fn();
const logEvent = vi.fn();
const updatePreferences = vi.fn();

vi.mock('@/contexts/CoachChatContext', () => ({
  useCoachChatLauncher: () => ({ openCoachChat }),
}));
vi.mock('@/hooks/useSessionLog', () => ({
  useSessionLog: () => ({ logEvent }),
}));
vi.mock('@/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ preferences: { micPermission: true }, updatePreferences }),
}));

let container: HTMLDivElement;
let root: Root;

function render(path: string) {
  function Bridge() {
    useReminderCheckinDeepLink();
    return null;
  }
  act(() =>
    root.render(
      <StrictMode>
        <MemoryRouter initialEntries={[path]}>
          <Bridge />
        </MemoryRouter>
      </StrictMode>,
    ),
  );
}

beforeEach(() => {
  openCoachChat.mockReset();
  logEvent.mockReset();
  updatePreferences.mockReset();
  useSessionLogStore.setState({ events: [] });
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

describe('useReminderCheckinDeepLink', () => {
  it('?checkin=morning → opens MCHECK-01 once, flips voice, logs start (StrictMode-safe)', () => {
    render('/home?checkin=morning');
    expect(openCoachChat).toHaveBeenCalledTimes(1);
    expect(openCoachChat).toHaveBeenCalledWith('MCHECK-01', { initiateCheckin: true });
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith('checkin_started', { type: 'morning' }, 'MCHECK-01');
    expect(updatePreferences).toHaveBeenCalledWith({ voiceMode: 'voice', micEnabled: true });
  });

  it('?checkin=evening → opens ECHECK-01', () => {
    render('/home?checkin=evening');
    expect(openCoachChat).toHaveBeenCalledWith('ECHECK-01', { initiateCheckin: true });
  });

  it('no checkin param → no coach open', () => {
    render('/home');
    expect(openCoachChat).not.toHaveBeenCalled();
  });

  it('done-today → opens plain chat and does NOT flip voice mode', () => {
    useSessionLogStore.setState({
      events: [
        {
          event_type: 'checkin_completed',
          payload: { type: 'morning' },
          timestamp: new Date().toISOString(),
        } as unknown as SessionLogEvent,
      ],
    });
    render('/home?checkin=morning');
    expect(openCoachChat).toHaveBeenCalledWith('HOME-CHECKIN', { initiateCheckin: false });
    expect(updatePreferences).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });
});
