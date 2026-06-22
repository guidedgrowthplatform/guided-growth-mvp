import { describe, it, expect } from 'vitest';
import { buildContextMessage } from '../buildContextMessage.js';

describe('buildContextMessage — filled_form_state', () => {
  it('renders nickname when present in filled_form_state', () => {
    const body = buildContextMessage({
      screen_id: 'ONBOARD-FORK',
      context_block: 'Fork screen.',
      state_delta: [],
      filled_form_state: { nickname: 'Jonas' },
    });
    expect(body).toContain('nickname: Jonas');
    expect(body).toContain('USER KNOWN STATE');
  });

  // Regression for #182: at FORK mount the in-flight snapshot ref can be stale
  // (empty). pushScreenContext merges persisted data UNDER it (in-flight wins),
  // so an already-persisted nickname must survive into the message body.
  it('keeps persisted nickname when merged under an empty in-flight snapshot', () => {
    const persisted = { nickname: 'Jonas', age: 30 };
    const inFlight: Record<string, unknown> = {};
    const filled = { ...persisted, ...inFlight };
    const body = buildContextMessage({
      screen_id: 'ONBOARD-FORK',
      context_block: 'Fork screen.',
      state_delta: [],
      filled_form_state: filled,
    });
    expect(body).toContain('nickname: Jonas');
  });

  it('lets in-flight overrides win over persisted on key collisions', () => {
    const persisted = { nickname: 'Stale' };
    const inFlight = { nickname: 'Fresh' };
    const filled = { ...persisted, ...inFlight };
    const body = buildContextMessage({
      screen_id: 'ONBOARD-FORK',
      context_block: 'Fork screen.',
      state_delta: [],
      filled_form_state: filled,
    });
    expect(body).toContain('nickname: Fresh');
    expect(body).not.toContain('nickname: Stale');
  });
});
