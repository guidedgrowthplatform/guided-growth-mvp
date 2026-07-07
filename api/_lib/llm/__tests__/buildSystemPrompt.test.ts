import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db.js', () => ({ default: { query: vi.fn() } }));

const pool = (await import('../../db.js')).default as { query: ReturnType<typeof vi.fn> };
const { buildSystemPromptForRequest } = await import('../buildSystemPrompt.js');

const BLOCK = `SCREEN_ID: HOME-MORNING
BEHAVIOR: Ask the thing. -> beginner path (ONBOARD-BEGINNER-01)
NEXT: New -> ONBOARD-BEGINNER-01.

--- SUPPLEMENTARY ---

AI RESPONSE PATTERN:
'Now let's pick a focus area.'`;

// Non-onboarding screen + recent_events → only the screen_contexts query fires.
const recent_events = [
  {
    id: 'e1',
    session_id: 's',
    timestamp: '2026-01-01T00:00:00Z',
    event_type: 'navigate',
    screen_id: 'HOME-MORNING',
    payload: {},
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [{ context_block: BLOCK, version: 3 }], rowCount: 1 });
});

describe('buildSystemPromptForRequest', () => {
  it('sanitizes forward pointers and injects the stay-on-screen rule', async () => {
    const { systemPrompt } = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'HOME-MORNING',
      coaching_style: 'warm',
      recent_events,
    });
    expect(systemPrompt).toContain('Stay On The Current Screen');
    expect(systemPrompt).not.toContain('ONBOARD-BEGINNER-01');
    expect(systemPrompt).not.toContain('NEXT:');
    expect(systemPrompt).toContain('BEHAVIOR:');
    // rule lands before the screen context it governs
    expect(systemPrompt.indexOf('Stay On The Current Screen')).toBeLessThan(
      systemPrompt.indexOf('BEHAVIOR:'),
    );
  });

  it('carries Yair identity, multilingual, verbatim 988, tone discipline globally', async () => {
    const { systemPrompt } = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'HOME-MORNING',
      coaching_style: 'warm',
      recent_events,
    });
    expect(systemPrompt).toContain('You are Yair');
    expect(systemPrompt).toContain('you are multilingual');
    expect(systemPrompt).toContain('Please reach out to 988');
    expect(systemPrompt).toContain('## Tone Discipline');
  });

  it('includes the read-options-on-request rule (recite when directly asked)', async () => {
    const { systemPrompt } = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'HOME-MORNING',
      coaching_style: 'warm',
      recent_events,
    });
    expect(systemPrompt).toContain('## Reading The On-Screen Options');
    expect(systemPrompt).toMatch(/what are my options\?/i);
    // default (no unprompted lists) + the direct-ask exception both present
    expect(systemPrompt).toMatch(/unprompted/i);
    expect(systemPrompt).toContain('DO read them');
  });

  it('injects PRODUCT_CONTEXT off onboarding, omits it on onboarding screens', async () => {
    const off = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'HOME-MORNING',
      coaching_style: 'warm',
      recent_events,
    });
    expect(off.systemPrompt).toContain('## What We Have Today (MVP)');
    expect(off.systemPrompt).toContain('Founding User Context');

    pool.query.mockReset();
    pool.query
      .mockResolvedValueOnce({
        rows: [
          { context_block: 'SCREEN_ID: ONBOARD-BEGINNER-02\nBEHAVIOR: pick goals.', version: 1 },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const on = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'ONBOARD-BEGINNER-02',
      coaching_style: 'warm',
      recent_events,
    });
    expect(on.systemPrompt).toContain('You are Yair');
    expect(on.systemPrompt).toContain('Please reach out to 988');
    expect(on.systemPrompt).not.toContain('## What We Have Today (MVP)');
    expect(on.systemPrompt).not.toContain('Founding User Context');
  });

  it('wires the canonical subcategory options into the final onboarding prompt', async () => {
    pool.query.mockReset();
    pool.query
      .mockResolvedValueOnce({
        rows: [
          { context_block: 'SCREEN_ID: ONBOARD-BEGINNER-02\nBEHAVIOR: pick goals.', version: 1 },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ data: { category: 'Sleep better' }, current_step: 4, path: 'simple' }],
        rowCount: 1,
      });
    const { systemPrompt } = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'ONBOARD-BEGINNER-02',
      coaching_style: 'warm',
      recent_events,
    });
    expect(systemPrompt).toContain('Subcategory Options (category: Sleep better)');
    expect(systemPrompt).toContain('Fall asleep earlier | Wake up earlier');
  });

  // {name} wiring: onboarding-gated substitution from onboarding_states.data.nickname.
  it('substitutes {name} in an onboarding context with the saved nickname', async () => {
    pool.query.mockReset();
    pool.query
      .mockResolvedValueOnce({
        rows: [{ context_block: 'SCREEN_ID: ONBOARD-ZZZ\nGreet {name} warmly.', version: 1 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ data: { nickname: 'Mint' }, current_step: 6, path: 'simple' }],
        rowCount: 1,
      });
    const { systemPrompt } = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'ONBOARD-ZZZ',
      coaching_style: 'warm',
      recent_events,
    });
    expect(systemPrompt).toContain('Greet Mint warmly.');
    expect(systemPrompt).not.toContain('Greet {name} warmly.');
  });

  it('drops the {name} token cleanly when no nickname is saved', async () => {
    pool.query.mockReset();
    pool.query
      .mockResolvedValueOnce({
        rows: [{ context_block: 'SCREEN_ID: ONBOARD-ZZZ\nGreet {name} warmly.', version: 1 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const { systemPrompt } = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'ONBOARD-ZZZ',
      coaching_style: 'warm',
      recent_events,
    });
    expect(systemPrompt).not.toContain('Greet {name} warmly.');
    expect(systemPrompt).toContain('Greet warmly.');
  });

  it('leaves {name} untouched on non-onboarding screens (gate)', async () => {
    pool.query.mockReset();
    pool.query.mockResolvedValue({
      rows: [{ context_block: 'SCREEN_ID: MCHECK-01\nGreet {name} warmly.', version: 1 }],
      rowCount: 1,
    });
    const { systemPrompt } = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'MCHECK-01',
      coaching_style: 'warm',
      recent_events,
    });
    expect(systemPrompt).toContain('{name}');
  });

  it('injects a Current Time line on check-in screens when timezone is given', async () => {
    pool.query.mockReset();
    pool.query
      .mockResolvedValueOnce({
        rows: [{ context_block: 'SCREEN_ID: MCHECK-01\nBEHAVIOR: check in.', version: 1 }],
        rowCount: 1,
      })
      .mockResolvedValue({ rows: [], rowCount: 0 });
    const { systemPrompt } = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'MCHECK-01',
      coaching_style: 'warm',
      recent_events,
      timezone: 'America/New_York',
    });
    expect(systemPrompt).toContain('## Current Time');
    expect(systemPrompt).toMatch(/Current local time: (morning|afternoon|evening|night)/);
  });

  it('omits the Current Time line off check-in screens and on missing/invalid tz', async () => {
    const noTz = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'HOME-MORNING',
      coaching_style: 'warm',
      recent_events,
      timezone: 'America/New_York',
    });
    expect(noTz.systemPrompt).not.toContain('## Current Time');

    pool.query.mockReset();
    pool.query
      .mockResolvedValueOnce({
        rows: [{ context_block: 'SCREEN_ID: MCHECK-01\nBEHAVIOR: check in.', version: 1 }],
        rowCount: 1,
      })
      .mockResolvedValue({ rows: [], rowCount: 0 });
    const badTz = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'MCHECK-01',
      coaching_style: 'warm',
      recent_events,
      timezone: 'Not/AZone',
    });
    expect(badTz.systemPrompt).not.toContain('## Current Time');
  });

  it('emits the evening habit walkthrough ONLY on ECHECK-01', async () => {
    pool.query.mockReset();
    pool.query
      .mockResolvedValueOnce({
        rows: [{ context_block: 'SCREEN_ID: ECHECK-01\nBEHAVIOR: evening check in.', version: 1 }],
        rowCount: 1,
      })
      .mockResolvedValue({ rows: [], rowCount: 0 });
    const evening = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'ECHECK-01',
      coaching_style: 'warm',
      recent_events,
    });
    expect(evening.systemPrompt).toContain('## Evening Check-in Flow');
    expect(evening.systemPrompt).toContain('complete_habit');
    // Reflection now defers to the user's configured questions, not hardcoded.
    expect(evening.systemPrompt).toContain('## Reflection Settings (this user)');
    expect(evening.systemPrompt).toContain('## Scripted Check-in — STRICT');
  });

  it('forces the evening opener to lead with habits ONLY on ECHECK-01 opener turns', async () => {
    const mockEchack = () => {
      pool.query.mockReset();
      pool.query
        .mockResolvedValueOnce({
          rows: [
            { context_block: 'SCREEN_ID: ECHECK-01\nBEHAVIOR: evening check in.', version: 1 },
          ],
          rowCount: 1,
        })
        .mockResolvedValue({ rows: [], rowCount: 0 });
    };

    mockEchack();
    const opener = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'ECHECK-01',
      coaching_style: 'warm',
      recent_events,
      mode: 'opener',
    });
    expect(opener.systemPrompt).toContain('## Evening Opener');
    expect(opener.systemPrompt).toContain('query_habits');
    expect(opener.systemPrompt).toMatch(/word-for-word/i);

    mockEchack();
    const chat = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'ECHECK-01',
      coaching_style: 'warm',
      recent_events,
      mode: 'chat',
    });
    expect(chat.systemPrompt).not.toContain('## Evening Opener');
  });

  it('emits the morning opener (not the evening one) on MCHECK-01 opener turns', async () => {
    const mockMcheck = () => {
      pool.query.mockReset();
      pool.query
        .mockResolvedValueOnce({
          rows: [
            { context_block: 'SCREEN_ID: MCHECK-01\nBEHAVIOR: morning check in.', version: 1 },
          ],
          rowCount: 1,
        })
        .mockResolvedValue({ rows: [], rowCount: 0 });
    };

    mockMcheck();
    const opener = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'MCHECK-01',
      coaching_style: 'warm',
      recent_events,
      mode: 'opener',
    });
    expect(opener.systemPrompt).toContain('## Morning Opener');
    expect(opener.systemPrompt).not.toContain('## Evening Opener');

    mockMcheck();
    const chat = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'MCHECK-01',
      coaching_style: 'warm',
      recent_events,
      mode: 'chat',
    });
    expect(chat.systemPrompt).not.toContain('## Morning Opener');
  });

  it('does NOT emit the morning opener block on ECHECK-01 opener turns', async () => {
    pool.query.mockReset();
    pool.query
      .mockResolvedValueOnce({
        rows: [{ context_block: 'SCREEN_ID: ECHECK-01\nBEHAVIOR: evening check in.', version: 1 }],
        rowCount: 1,
      })
      .mockResolvedValue({ rows: [], rowCount: 0 });
    const { systemPrompt } = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'ECHECK-01',
      coaching_style: 'warm',
      recent_events,
      mode: 'opener',
    });
    expect(systemPrompt).not.toContain('## Morning Opener');
  });

  it('does NOT emit the walkthrough on MCHECK-01, HOME-CHECKIN, or non-checkin screens', async () => {
    for (const id of ['MCHECK-01', 'HOME-CHECKIN', 'HOME-MORNING']) {
      pool.query.mockReset();
      pool.query
        .mockResolvedValueOnce({
          rows: [{ context_block: `SCREEN_ID: ${id}\nBEHAVIOR: check in.`, version: 1 }],
          rowCount: 1,
        })
        .mockResolvedValue({ rows: [], rowCount: 0 });
      const { systemPrompt } = await buildSystemPromptForRequest({
        anon_id: 'a',
        screen_id: id,
        coaching_style: 'warm',
        recent_events,
      });
      expect(systemPrompt).not.toContain('## Evening Check-in Flow');
    }
  });

  it('injects the text-mode rule when input_mode=text or absent, the voice-mode rule when voice', async () => {
    const text = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'HOME-MORNING',
      coaching_style: 'warm',
      recent_events,
      input_mode: 'text',
    });
    expect(text.systemPrompt).toContain('## Text Mode');
    expect(text.systemPrompt).toContain('TYPING, not speaking');

    const absent = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'HOME-MORNING',
      coaching_style: 'warm',
      recent_events,
    });
    expect(absent.systemPrompt).toContain('## Text Mode');

    const voice = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'HOME-MORNING',
      coaching_style: 'warm',
      recent_events,
      input_mode: 'voice',
    });
    expect(voice.systemPrompt).not.toContain('## Text Mode');
    expect(voice.systemPrompt).toContain('## Voice Mode');
    expect(voice.systemPrompt).toContain("never claim you can't hear them");
  });

  it('opener instructions reference BEHAVIOR, not the stripped AI RESPONSE PATTERN', async () => {
    const { systemPrompt } = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'HOME-MORNING',
      coaching_style: 'warm',
      recent_events,
      mode: 'opener',
    });
    expect(systemPrompt).toContain('Opener Turn');
    expect(systemPrompt).toContain("this screen's BEHAVIOR calls for");
    expect(systemPrompt).not.toContain('AI RESPONSE PATTERN');
  });

  // G07: weekly-day recommendation threading
  describe('weekly-day recommendation block (G07)', () => {
    function mockWeeklySetup() {
      pool.query.mockReset();
      pool.query
        .mockResolvedValueOnce({
          rows: [{ context_block: 'SCREEN_ID: ONBOARD-WEEKLY-SETUP\nBEHAVIOR: pick day.', version: 1 }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // onboarding_states
    }

    it('injects Saturday (day=6) for Asia/Jerusalem timezone', async () => {
      mockWeeklySetup();
      const { systemPrompt } = await buildSystemPromptForRequest({
        anon_id: 'a',
        screen_id: 'ONBOARD-WEEKLY-SETUP',
        coaching_style: 'warm',
        recent_events,
        timezone: 'Asia/Jerusalem',
      });
      expect(systemPrompt).toContain('## Recommended Weekly Day');
      expect(systemPrompt).toContain('Saturday');
      expect(systemPrompt).toContain('day=6');
      // Block overrides the language heuristic — the block precedes the beat context
      // in the prompt and explicitly says to ignore language-based heuristics.
      expect(systemPrompt).toContain('Ignore any language-based day heuristic');
    });

    it('injects Sunday (day=0) for a Monday-start timezone (America/New_York)', async () => {
      mockWeeklySetup();
      const { systemPrompt } = await buildSystemPromptForRequest({
        anon_id: 'a',
        screen_id: 'ONBOARD-WEEKLY-SETUP',
        coaching_style: 'warm',
        recent_events,
        timezone: 'America/New_York',
      });
      expect(systemPrompt).toContain('## Recommended Weekly Day');
      expect(systemPrompt).toContain('Sunday');
      expect(systemPrompt).toContain('day=0');
    });

    it('defaults to Sunday when timezone is absent', async () => {
      mockWeeklySetup();
      const { systemPrompt } = await buildSystemPromptForRequest({
        anon_id: 'a',
        screen_id: 'ONBOARD-WEEKLY-SETUP',
        coaching_style: 'warm',
        recent_events,
      });
      expect(systemPrompt).toContain('## Recommended Weekly Day');
      expect(systemPrompt).toContain('Sunday');
      expect(systemPrompt).toContain('day=0');
    });

    it('does NOT inject the weekly-day block on other onboarding screens', async () => {
      pool.query.mockReset();
      pool.query
        .mockResolvedValueOnce({
          rows: [{ context_block: 'SCREEN_ID: ONBOARD-BEGINNER-02\nBEHAVIOR: goals.', version: 1 }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const { systemPrompt } = await buildSystemPromptForRequest({
        anon_id: 'a',
        screen_id: 'ONBOARD-BEGINNER-02',
        coaching_style: 'warm',
        recent_events,
        timezone: 'Asia/Jerusalem',
      });
      expect(systemPrompt).not.toContain('## Recommended Weekly Day');
    });

    it('does NOT inject the weekly-day block on non-onboarding screens', async () => {
      const { systemPrompt } = await buildSystemPromptForRequest({
        anon_id: 'a',
        screen_id: 'HOME-MORNING',
        coaching_style: 'warm',
        recent_events,
        timezone: 'Asia/Jerusalem',
      });
      expect(systemPrompt).not.toContain('## Recommended Weekly Day');
    });
  });
});
