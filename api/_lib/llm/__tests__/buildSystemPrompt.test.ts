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
    expect(evening.systemPrompt).toContain('scope:"today"');
    expect(evening.systemPrompt).toContain('complete_habit');
    expect(evening.systemPrompt).toMatch(/did.?n.?t/i);
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
    expect(opener.systemPrompt).toContain('## Evening Opener (this turn only)');
    expect(opener.systemPrompt).toContain('Do NOT open with a reflection question');

    mockEchack();
    const chat = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'ECHECK-01',
      coaching_style: 'warm',
      recent_events,
      mode: 'chat',
    });
    expect(chat.systemPrompt).not.toContain('## Evening Opener (this turn only)');
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
    expect(opener.systemPrompt).toContain('## Morning Opener (this turn only)');
    expect(opener.systemPrompt).not.toContain('## Evening Opener (this turn only)');

    mockMcheck();
    const chat = await buildSystemPromptForRequest({
      anon_id: 'a',
      screen_id: 'MCHECK-01',
      coaching_style: 'warm',
      recent_events,
      mode: 'chat',
    });
    expect(chat.systemPrompt).not.toContain('## Morning Opener (this turn only)');
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
    expect(systemPrompt).not.toContain('## Morning Opener (this turn only)');
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

  it('injects the text-mode rule when input_mode=text or absent, omits it when voice', async () => {
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
});
