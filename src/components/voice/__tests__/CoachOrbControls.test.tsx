// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachDailySession } from '@/lib/coach/coachDailySession';
import { CoachOrbControls } from '../CoachOrbControls';

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

describe('CoachOrbControls', () => {
  it('routes orb sound/mic taps to Daily mute and Leave to session end', async () => {
    const session = {
      start: vi.fn().mockResolvedValue(undefined),
      toggleMute: vi.fn().mockResolvedValue(undefined),
      leave: vi.fn().mockResolvedValue(undefined),
    } as unknown as CoachDailySession;
    const onLeave = vi.fn();
    await act(async () => {
      root.render(<CoachOrbControls session={session} onUnavailable={vi.fn()} onLeave={onLeave} />);
    });

    const controls = container.querySelectorAll('button');
    await act(async () => {
      controls[0].click();
      await Promise.resolve();
      controls[2].click();
      await Promise.resolve();
    });

    expect(session.toggleMute).toHaveBeenCalledOnce();
    expect(session.leave).toHaveBeenCalledOnce();
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('returns to the chat when leaving the Daily session rejects', async () => {
    const session = {
      start: vi.fn().mockResolvedValue(undefined),
      toggleMute: vi.fn().mockResolvedValue(undefined),
      leave: vi.fn().mockRejectedValue(new Error('daily_leave_failed')),
    } as unknown as CoachDailySession;
    const onLeave = vi.fn();
    await act(async () => {
      root.render(<CoachOrbControls session={session} onUnavailable={vi.fn()} onLeave={onLeave} />);
    });

    const leaveButton = container.querySelector(
      '[aria-label="Leave coach session"]',
    ) as HTMLButtonElement;
    await act(async () => {
      leaveButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(session.leave).toHaveBeenCalledOnce();
    expect(onLeave).toHaveBeenCalledOnce();
  });
});
