import { describe, expect, it, vi } from 'vitest';
import { CoachDailySession, coachOrbStateFromCall, type DailyCallLike } from '../coachDailySession';

function response(body: unknown, ok = true, status = 201): Response {
  return { ok, status, json: async () => body } as Response;
}

function mockCall() {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const call: DailyCallLike = {
    join: vi.fn().mockResolvedValue(undefined),
    leave: vi.fn().mockResolvedValue(undefined),
    setLocalAudio: vi.fn(),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) =>
      listeners.set(event, listener),
    ),
    off: vi.fn(),
  };
  return { call, emit: (event: string, payload?: unknown) => listeners.get(event)?.(payload) };
}

describe('CoachDailySession', () => {
  it('maps bot audio, local mic audio, and silence to coach, user, and idle', async () => {
    expect(coachOrbStateFromCall(true, false)).toBe('coach');
    expect(coachOrbStateFromCall(false, true)).toBe('user');
    expect(coachOrbStateFromCall(false, false)).toBe('idle');

    const states: string[] = [];
    const { call, emit } = mockCall();
    const session = new CoachDailySession({
      createCall: async () => call,
      fetcher: vi
        .fn()
        .mockResolvedValue(response({ sessionId: 's1', roomUrl: 'https://room', token: 'token' })),
      onState: (state) => states.push(state),
    });
    await session.start();
    emit('participant-updated', { participant: { local: true, session_id: 'local' } });
    emit('active-speaker-change', { activeSpeaker: { peerId: 'bot' } });
    emit('active-speaker-change', { activeSpeaker: { peerId: 'local' } });
    emit('local-audio-level', { audioLevel: 0.4 });
    emit('local-audio-level', { audioLevel: 0 });

    expect(states).toEqual(['thinking', 'coach', 'idle', 'user', 'idle']);
  });

  it('toggles local audio and ends the server session when leaving', async () => {
    const { call } = mockCall();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ sessionId: 's1', roomUrl: 'https://room', token: 'token' }))
      .mockResolvedValueOnce(response({ ended: true }));
    const session = new CoachDailySession({ createCall: async () => call, fetcher });
    await session.start();
    await session.toggleMute();
    await session.leave();

    expect(call.setLocalAudio).toHaveBeenCalledWith(false);
    expect(call.leave).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenLastCalledWith(
      '/api/voice/session/end',
      expect.objectContaining({ body: JSON.stringify({ sessionId: 's1' }) }),
    );
  });

  it('tears down and ends the server session when the client leave rejects', async () => {
    const leaveError = new Error('daily_leave_failed');
    const states: string[] = [];
    const { call } = mockCall();
    call.leave = vi.fn().mockRejectedValue(leaveError);
    call.destroy = vi.fn();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ sessionId: 's1', roomUrl: 'https://room', token: 'token' }))
      .mockResolvedValueOnce(response({ ended: true }));
    const session = new CoachDailySession({
      createCall: async () => call,
      fetcher,
      onState: (state) => states.push(state),
    });
    await session.start();

    await expect(session.leave()).rejects.toBe(leaveError);

    expect(call.destroy).toHaveBeenCalledOnce();
    expect(states).toEqual(['thinking', 'idle']);
    expect(fetcher).toHaveBeenLastCalledWith(
      '/api/voice/session/end',
      expect.objectContaining({ body: JSON.stringify({ sessionId: 's1' }) }),
    );
  });
});
