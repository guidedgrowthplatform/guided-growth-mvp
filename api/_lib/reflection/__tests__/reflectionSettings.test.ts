import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db.js', () => ({ default: { query: vi.fn(), connect: vi.fn() } }));

const pool = (await import('../../db.js')).default as {
  query: ReturnType<typeof vi.fn>;
};

const { DEFAULT_REFLECTION_PROMPTS } = await import('@gg/shared/types');
const { readReflectionSettings, sanitizePrompts, DEFAULT_REFLECTION_SETTINGS } =
  await import('../reflectionSettings.js');

const ANON = '11111111-1111-4111-8111-111111111111';

// A saved row whose values are deliberately DISTINCT from the defaults, so
// "read the saved config" and "fall back to defaults" can never be confused.
function savedRow(prompts: string[]) {
  return {
    mode: 'prompts',
    prompts,
    reminder_time: '21:30',
    schedule_days: [1, 2, 3, 4, 5],
    reminder_enabled: false,
    schedule_label: 'Weekday',
    weekly_day: 3,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Rule 6: daily reflection reads the saved onboarding config ───────────
describe('rule 6 — readReflectionSettings uses the saved row, not defaults', () => {
  it('returns the persisted settings verbatim when a row exists', async () => {
    const custom = ['My own reflection question?'];
    pool.query.mockResolvedValueOnce({ rows: [savedRow(custom)] });

    const settings = await readReflectionSettings(ANON);

    expect(settings.prompts).toEqual(custom);
    expect(settings.time).toBe('21:30');
    expect(settings.days).toEqual([1, 2, 3, 4, 5]);
    expect(settings.reminder).toBe(false);
    expect(settings.schedule).toBe('Weekday');
    expect(settings.weeklyDay).toBe(3);
    // Proves it is NOT the default fallback.
    expect(settings.prompts).not.toEqual(DEFAULT_REFLECTION_PROMPTS);
    expect(settings).not.toEqual(DEFAULT_REFLECTION_SETTINGS);
  });

  it('falls back to defaults only when NO row exists', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const settings = await readReflectionSettings(ANON);
    expect(settings).toEqual(DEFAULT_REFLECTION_SETTINGS);
  });

  it('scopes the read to the caller anon_id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [savedRow(['q'])] });
    await readReflectionSettings(ANON);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM reflection_settings WHERE anon_id = \$1/);
    expect(params?.[0]).toBe(ANON);
  });
});

// ─── Rule 7: custom prompts stored and replayed verbatim ──────────────────
describe('rule 7 — custom reflection prompts survive the round-trip verbatim', () => {
  it('sanitizePrompts keeps under-cap prompts word-for-word (trim only)', () => {
    const authored = ['What went well today?', 'Where did I struggle, honestly?'];
    // sanitize trims surrounding whitespace but preserves content under the cap.
    expect(sanitizePrompts(authored)).toEqual(authored);
    expect(sanitizePrompts(['  padded  '])).toEqual(['padded']);
  });

  it('saved custom prompts read back byte-identical through readReflectionSettings', async () => {
    const authored = ['What am I avoiding?', 'One kind thing I did today?'];
    const stored = sanitizePrompts(authored);
    expect(stored).toEqual(authored); // under the 280-char cap → verbatim

    pool.query.mockResolvedValueOnce({ rows: [savedRow(stored)] });
    const settings = await readReflectionSettings(ANON);
    expect(settings.prompts).toEqual(authored);
  });

  it('the 280-char cap truncates (documents the boundary the verbatim claim depends on)', () => {
    const long = 'x'.repeat(300);
    const [out] = sanitizePrompts([long]);
    expect(out.length).toBe(280);
  });
});
