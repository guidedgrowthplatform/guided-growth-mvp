import { afterEach, describe, expect, it, vi } from 'vitest';
import { track } from '@/analytics';
import type { LLMToolEvent } from '@gg/shared/types/llm';
import { isCheckinScreen, trackCheckinStarted, trackCoachToolEvent } from '../coachFunnel';

vi.mock('@/analytics', () => ({ track: vi.fn() }));
const trackMock = track as unknown as ReturnType<typeof vi.fn>;

function evt(name: string, args: Record<string, unknown> = {}): LLMToolEvent {
  return { id: 'e1', name, args, result: { ok: true, payload: {} } };
}

afterEach(() => vi.clearAllMocks());

describe('isCheckinScreen', () => {
  it('matches the three check-in surfaces only', () => {
    expect(isCheckinScreen('HOME-CHECKIN')).toBe(true);
    expect(isCheckinScreen('MCHECK-01')).toBe(true);
    expect(isCheckinScreen('ECHECK-06')).toBe(true);
    expect(isCheckinScreen('HOME-FIRST')).toBe(false);
    expect(isCheckinScreen('CHAT')).toBe(false);
  });
});

describe('trackCoachToolEvent', () => {
  it('maps create_habit with derived frequency_days', () => {
    trackCoachToolEvent(evt('create_habit', { name: 'Meditate', schedule_days: [1, 3, 5] }));
    expect(trackMock).toHaveBeenCalledWith('create_habit', {
      source: 'coach_chat',
      habit_name: 'Meditate',
      frequency_days: 3,
    });
  });

  it('maps record_checkin → complete_checkin', () => {
    trackCoachToolEvent(evt('record_checkin', { mood: 4, sleep: 3 }));
    expect(trackMock).toHaveBeenCalledWith(
      'complete_checkin',
      expect.objectContaining({ source: 'coach_chat', mood: 4, sleep_quality: 3 }),
    );
  });

  it('ignores tools with no funnel meaning', () => {
    trackCoachToolEvent(evt('query_habits'));
    expect(trackMock).not.toHaveBeenCalled();
  });
});

describe('trackCheckinStarted', () => {
  it('derives checkin_type from the screen prefix, not the clock', () => {
    trackCheckinStarted('MCHECK-01');
    expect(trackMock).toHaveBeenCalledWith(
      'start_checkin',
      expect.objectContaining({ checkin_type: 'morning', source: 'coach_chat' }),
    );
    trackCheckinStarted('ECHECK-06');
    expect(trackMock).toHaveBeenLastCalledWith(
      'start_checkin',
      expect.objectContaining({ checkin_type: 'evening' }),
    );
  });
});
