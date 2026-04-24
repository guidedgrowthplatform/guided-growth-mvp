import { describe, expect, it } from 'vitest';
import { computeOpenAppEvent } from '../openAppTracking';

describe('computeOpenAppEvent', () => {
  it('treats first-ever open (null last date) as first_open_today=true and session_number=1', () => {
    const result = computeOpenAppEvent({
      todayIso: '2026-04-21',
      lastOpenDate: null,
      sessionCountStr: null,
      platform: 'web',
    });

    expect(result.props.is_first_open_today).toBe(true);
    expect(result.props.days_since_last_open).toBeNull();
    expect(result.props.session_number).toBe(1);
    expect(result.props.platform).toBe('web');
    expect(result.nextLastOpenDate).toBe('2026-04-21');
    expect(result.nextSessionCount).toBe('1');
  });

  it('same-day reopen: is_first_open_today=false, days_since_last_open=0, session increments', () => {
    const result = computeOpenAppEvent({
      todayIso: '2026-04-21',
      lastOpenDate: '2026-04-21',
      sessionCountStr: '7',
      platform: 'web',
    });

    expect(result.props.is_first_open_today).toBe(false);
    expect(result.props.days_since_last_open).toBe(0);
    expect(result.props.session_number).toBe(8);
    expect(result.nextSessionCount).toBe('8');
  });

  it('next-day open: is_first_open_today=true, days_since_last_open=1, session increments', () => {
    const result = computeOpenAppEvent({
      todayIso: '2026-04-21',
      lastOpenDate: '2026-04-20',
      sessionCountStr: '3',
      platform: 'android',
    });

    expect(result.props.is_first_open_today).toBe(true);
    expect(result.props.days_since_last_open).toBe(1);
    expect(result.props.session_number).toBe(4);
    expect(result.props.platform).toBe('android');
  });

  it('multi-day gap: reports correct days_since_last_open', () => {
    const result = computeOpenAppEvent({
      todayIso: '2026-04-21',
      lastOpenDate: '2026-04-14',
      sessionCountStr: '15',
      platform: 'ios',
    });

    expect(result.props.days_since_last_open).toBe(7);
    expect(result.props.is_first_open_today).toBe(true);
    expect(result.props.session_number).toBe(16);
  });

  it('corrupt session count falls back to 0 (session_number becomes 1)', () => {
    const result = computeOpenAppEvent({
      todayIso: '2026-04-21',
      lastOpenDate: '2026-04-21',
      sessionCountStr: 'not-a-number',
      platform: 'web',
    });

    expect(result.props.session_number).toBe(1);
  });

  it('empty string session count treated as 0', () => {
    const result = computeOpenAppEvent({
      todayIso: '2026-04-21',
      lastOpenDate: null,
      sessionCountStr: '',
      platform: 'web',
    });

    expect(result.props.session_number).toBe(1);
  });
});
