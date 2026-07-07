import { describe, expect, it, vi } from 'vitest';

// [...path].ts pulls in db.js + auth.js (which requires SUPABASE_* env vars at
// import time via supabase-admin.ts) — mock the chain so this pure-function
// test doesn't need real credentials, same pattern as the other api/ route tests.
vi.mock('../../_lib/db.js', () => ({ default: { query: vi.fn(), connect: vi.fn() } }));
vi.mock('../../_lib/auth.js', () => ({
  requireUser: vi.fn(),
  setUserContext: vi.fn(),
  handlePreflight: vi.fn(),
}));

const { buildHistory, fixOnboardingThreadSeams } = await import('../[...path].js');

// W2-E: round-2 judge (docs/qa-rounds/round2-judge-2026-07-07.md, R07) found
// missing-space seams on tool-call-failure recap messages that reproduce as
// SETTLED final DOM — the merged B56/B57 fix (fixSentenceJoinSpacing, wired
// only into useLLM.ts's live stream) never touches history rehydrated from
// chat_messages. These tests cover both raw-content read sites.
describe('buildHistory seam repair (W2-E)', () => {
  it('repairs a glued seam on an assistant row, judge repro shape 1', () => {
    const messages = buildHistory([
      {
        id: 'a1',
        turn_index: 0,
        role: 'assistant',
        content:
          "I'm having a recurring issue with adding the evening check-in.Let's simplify this.",
        tool_calls: null,
        tool_call_id: null,
        tool_name: null,
      },
    ]);
    expect(messages[0].content).toBe(
      "I'm having a recurring issue with adding the evening check-in. Let's simplify this.",
    );
  });

  it('repairs a glued seam on an assistant row, judge repro shape 2', () => {
    const messages = buildHistory([
      {
        id: 'a2',
        turn_index: 0,
        role: 'assistant',
        content: "there's still an issue adding that habit.Let's try this instead.",
        tool_calls: null,
        tool_call_id: null,
        tool_name: null,
      },
    ]);
    expect(messages[0].content).toBe(
      "there's still an issue adding that habit. Let's try this instead.",
    );
  });

  it('leaves user row content untouched (never LLM-composed)', () => {
    const messages = buildHistory([
      {
        id: 'u1',
        turn_index: 0,
        role: 'user',
        content: 'yes.please add it',
        tool_calls: null,
        tool_call_id: null,
        tool_name: null,
      },
    ]);
    expect(messages[0].content).toBe('yes.please add it');
  });

  it('is a no-op on text with no glued seam', () => {
    const messages = buildHistory([
      {
        id: 'a3',
        turn_index: 0,
        role: 'assistant',
        content: 'All set. What would you like to do next?',
        tool_calls: null,
        tool_call_id: null,
        tool_name: null,
      },
    ]);
    expect(messages[0].content).toBe('All set. What would you like to do next?');
  });
});

describe('fixOnboardingThreadSeams (W2-E)', () => {
  it('repairs the judge repro shape on an assistant turn in the onboarding thread feed', () => {
    const out = fixOnboardingThreadSeams([
      {
        id: 't1',
        client_turn_key: null,
        role: 'assistant',
        content:
          "I'm having a recurring issue with adding the evening check-in.Let's simplify this.",
        screen_id: 'ONBOARD-BEGINNER-06',
      },
    ]);
    expect(out[0].content).toBe(
      "I'm having a recurring issue with adding the evening check-in. Let's simplify this.",
    );
  });

  it('leaves user turns untouched', () => {
    const out = fixOnboardingThreadSeams([
      {
        id: 't2',
        client_turn_key: 'vapi-1',
        role: 'user',
        content: 'yes.please add it',
        screen_id: 'ONBOARD-BEGINNER-06',
      },
    ]);
    expect(out[0].content).toBe('yes.please add it');
  });

  it('handles null content without throwing', () => {
    const out = fixOnboardingThreadSeams([
      {
        id: 't3',
        client_turn_key: null,
        role: 'assistant',
        content: null,
        screen_id: 'ONBOARD-BEGINNER-06',
      },
    ]);
    expect(out[0].content).toBe('');
  });
});
