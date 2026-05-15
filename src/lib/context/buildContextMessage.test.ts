import { describe, expect, it } from 'vitest';
import type { SessionStateDeltaEntry } from '@/api/context';
import { buildContextMessage } from './buildContextMessage';

function entry(over: Partial<SessionStateDeltaEntry> = {}): SessionStateDeltaEntry {
  return {
    id: 'evt-1',
    session_id: 'sess-1',
    timestamp: '2026-05-13T12:00:00.000Z',
    event_type: 'navigate',
    screen_id: null,
    payload: null,
    ...over,
  };
}

describe('buildContextMessage', () => {
  it('includes the screen id, context block, and an empty-delta marker', () => {
    const out = buildContextMessage({
      screen_id: 'ONBOARD-WELCOME',
      context_block: 'You are on the welcome screen.',
      state_delta: [],
    });

    expect(out).toContain('ONBOARD-WELCOME');
    expect(out).toContain('You are on the welcome screen.');
    expect(out).toContain('(none)');
  });

  it('renders a single event without a payload as event_type + timestamp only', () => {
    const out = buildContextMessage({
      screen_id: 'HOME',
      context_block: 'home',
      state_delta: [entry({ event_type: 'voice_started', timestamp: '2026-05-13T12:00:00.000Z' })],
    });

    expect(out).toContain('- voice_started at 2026-05-13T12:00:00.000Z');
    expect(out).not.toContain('—');
  });

  it('appends a JSON payload after an em-dash when payload is non-empty', () => {
    const out = buildContextMessage({
      screen_id: 'HOME',
      context_block: 'home',
      state_delta: [entry({ event_type: 'habit_completed', payload: { habit_id: 'h1' } })],
    });

    expect(out).toContain('- habit_completed at 2026-05-13T12:00:00.000Z — {"habit_id":"h1"}');
  });

  it('omits the payload suffix when payload is an empty object', () => {
    const out = buildContextMessage({
      screen_id: 'HOME',
      context_block: 'home',
      state_delta: [entry({ event_type: 'mic_tapped', payload: {} })],
    });

    expect(out).toContain('- mic_tapped at 2026-05-13T12:00:00.000Z');
    expect(out).not.toContain('—');
  });

  it('renders multiple events in array order', () => {
    const out = buildContextMessage({
      screen_id: 'HOME',
      context_block: 'home',
      state_delta: [
        entry({ id: 'a', event_type: 'voice_started', timestamp: '2026-05-13T12:00:00.000Z' }),
        entry({ id: 'b', event_type: 'voice_ended', timestamp: '2026-05-13T12:00:30.000Z' }),
      ],
    });

    const aIdx = out.indexOf('voice_started');
    const bIdx = out.indexOf('voice_ended');
    expect(aIdx).toBeGreaterThan(-1);
    expect(bIdx).toBeGreaterThan(aIdx);
  });

  it('is deterministic — same input yields byte-identical output', () => {
    const input = {
      screen_id: 'ONBOARD-WELCOME',
      context_block: 'block',
      state_delta: [entry({ event_type: 'navigate', payload: { target_screen: 'MCHECK-01' } })],
    } as const;
    expect(buildContextMessage(input)).toBe(buildContextMessage(input));
  });

  it('canonical-format snapshot — any change must be intentional', () => {
    // Every channel (Vapi, callLLM, Async) sends this exact body. Diffing
    // this snapshot in a PR means the cross-channel parity test (P1-43) is
    // about to break — reviewers must update all consumers in lockstep.
    const out = buildContextMessage({
      screen_id: 'MCHECK-01',
      context_block: 'You are on the morning check-in. Ask about sleep first.',
      state_delta: [
        entry({
          id: 'a',
          event_type: 'navigate',
          timestamp: '2026-05-13T12:00:00.000Z',
          payload: { target_screen: 'MCHECK-01' },
        }),
        entry({
          id: 'b',
          event_type: 'voice_started',
          timestamp: '2026-05-13T12:00:05.000Z',
          payload: null,
        }),
      ],
    });
    expect(out).toMatchSnapshot();
  });
});
