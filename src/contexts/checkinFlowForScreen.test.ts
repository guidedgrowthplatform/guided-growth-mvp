import { describe, expect, it } from 'vitest';
import { checkinFlowForScreen } from './CoachChatContext';

describe('checkinFlowForScreen', () => {
  it('maps dedicated check-in screens to their beat flow', () => {
    expect(checkinFlowForScreen('MCHECK-01')).toBe('morning-checkin-v1');
    expect(checkinFlowForScreen('ECHECK-01')).toBe('evening-checkin-v1');
  });

  it('returns null for HOME-CHECKIN (stays LLM chat) and null screen', () => {
    expect(checkinFlowForScreen('HOME-CHECKIN')).toBeNull();
    expect(checkinFlowForScreen(null)).toBeNull();
  });
});
