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

  it('wires the canonical goal options into the final onboarding prompt', async () => {
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
    expect(systemPrompt).toContain('Goal Options (category: Sleep better)');
    expect(systemPrompt).toContain('Fall asleep earlier | Wake up earlier');
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
