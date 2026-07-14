/**
 * Server-side onboarding completion service + Direct-LLM confirm_plan wiring.
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db.js', () => ({ default: { query: vi.fn(), connect: vi.fn() } }));
vi.mock('../../supabase.js', () => ({
  supabaseAdmin: {
    auth: { admin: { updateUserById: vi.fn().mockResolvedValue({ error: null }) } },
  },
}));

const { completeOnboarding } = await import('../completeOnboarding.js');
const { confirmPlan } = await import('../../llm/onboarding/handlers/confirmPlan.js');
const pool = (await import('../../db.js')).default as {
  query: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
};

const ANON = '11111111-1111-4111-8111-111111111111';
const AUTH_ID = '22222222-2222-4222-8222-222222222222';

type Call = { sql: string; params: unknown[] };

// A fake pooled client that records queries and replies from a scripted map keyed
// by a substring match on the SQL. Falls back to an empty rowset.
// reflection_settings INSERT..RETURNING is always mapped by upsertReflectionSettings,
// so every executor returns a valid row for it unless the script overrides.
const REFLECTION_ROW = {
  match: /reflection_settings/,
  rows: [
    {
      mode: 'prompts',
      prompts: [],
      reminder_time: null,
      schedule_days: [],
      reminder_enabled: true,
      schedule_label: null,
      weekly_day: 0,
    },
  ],
};

function makeExecutor(script: Array<{ match: RegExp; rows: unknown[] }>) {
  const calls: Call[] = [];
  const full = [...script, REFLECTION_ROW];
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params: params ?? [] });
    const hit = full.find((s) => s.match.test(sql));
    return { rows: hit ? hit.rows : [], rowCount: hit ? hit.rows.length : 0 };
  });
  return { executor: { query }, calls };
}

const COMPLETING_STATE = [
  { match: /SELECT status FROM onboarding_states/, rows: [{ status: 'in_progress' }] },
  {
    match: /UPDATE onboarding_states\s+SET data/,
    rows: [
      {
        path: 'simple',
        data: {
          nickname: 'Yair',
          age: 28,
          gender: 'Other',
          habitConfigs: { Walk: { days: [1, 2, 3], time: '07:00', habitType: 'binary_avoid' } },
          reflectionConfig: { time: '21:00', days: [1, 2, 3, 4, 5], reminder: true },
        },
      },
    ],
  },
  { match: /SELECT id FROM profiles WHERE anon_id/, rows: [{ id: AUTH_ID }] },
];

beforeEach(() => vi.clearAllMocks());

describe('completeOnboarding service (executor lane)', () => {
  it('flips status=completed, promotes habits, writes plan.confirmed, resolves auth id', async () => {
    const { executor, calls } = makeExecutor(COMPLETING_STATE);
    const res = await completeOnboarding({ anonId: ANON, setPlanConfirmed: true, executor });
    expect(res).toEqual({ ok: true, completed: true, alreadyCompleted: false });

    const update = calls.find((c) => /UPDATE onboarding_states\s+SET data/.test(c.sql))!;
    expect(update.sql).toContain("status = 'completed'");
    expect(update.sql).toContain('completed_at = now()');
    const merge = JSON.parse(update.params[1] as string);
    expect(merge.plan).toEqual({ confirmed: true });

    const insert = calls.find((c) => /INSERT INTO user_habits/.test(c.sql))!;
    expect(insert.params[0]).toBe(ANON);
    expect(insert.params[1]).toBe('Walk');
    expect(insert.params[2]).toBe('binary_avoid');

    // profiles + reflection materialized under the resolved auth id.
    expect(calls.some((c) => /UPDATE profiles SET/.test(c.sql))).toBe(true);
    expect(calls.some((c) => /reflection_settings/.test(c.sql))).toBe(true);
  });

  it('re-confirm on an already-completed row is an idempotent no-op success', async () => {
    const { executor, calls } = makeExecutor([
      { match: /SELECT status FROM onboarding_states/, rows: [{ status: 'completed' }] },
    ]);
    const res = await completeOnboarding({ anonId: ANON, setPlanConfirmed: true, executor });
    expect(res).toEqual({ ok: true, completed: true, alreadyCompleted: true });
    // No UPDATE / INSERT — only the status probe ran.
    expect(calls.every((c) => /SELECT status/.test(c.sql))).toBe(true);
  });

  it('missing onboarding row returns no_state', async () => {
    const { executor } = makeExecutor([]);
    const res = await completeOnboarding({ anonId: ANON, executor });
    expect(res).toEqual({ ok: false, reason: 'no_state' });
  });

  it('promotes advancedHabitConfigs when habitConfigs absent', async () => {
    const { executor, calls } = makeExecutor([
      { match: /SELECT status FROM onboarding_states/, rows: [{ status: 'in_progress' }] },
      {
        match: /UPDATE onboarding_states\s+SET data/,
        rows: [
          {
            path: 'braindump',
            data: { advancedHabitConfigs: { Run: { days: [1, 3, 5], time: '06:00' } } },
          },
        ],
      },
      { match: /SELECT id FROM profiles WHERE anon_id/, rows: [{ id: AUTH_ID }] },
    ]);
    await completeOnboarding({ anonId: ANON, executor });
    const insert = calls.find((c) => /INSERT INTO user_habits/.test(c.sql))!;
    expect(insert.params[1]).toBe('Run');
  });

  it('skips profile + metadata writes when no profile links the anon_id', async () => {
    const { executor, calls } = makeExecutor([
      { match: /SELECT status FROM onboarding_states/, rows: [{ status: 'in_progress' }] },
      {
        match: /UPDATE onboarding_states\s+SET data/,
        rows: [{ path: 'simple', data: { nickname: 'Yair', habitConfigs: {} } }],
      },
      { match: /SELECT id FROM profiles WHERE anon_id/, rows: [] },
    ]);
    const res = await completeOnboarding({ anonId: ANON, executor });
    expect(res.ok).toBe(true);
    expect(calls.some((c) => /UPDATE profiles SET/.test(c.sql))).toBe(false);
  });
});

// The Direct handler uses the module pool (connect), so drive it through a fake
// pooled client returned by pool.connect().
describe('Direct-LLM confirm_plan handler', () => {
  function wireConnect(script: Array<{ match: RegExp; rows: unknown[] }>) {
    const { executor, calls } = makeExecutor(script);
    pool.connect.mockResolvedValue({ ...executor, release: vi.fn() });
    return calls;
  }

  it('completes server-side after the plan-ready guard passes', async () => {
    // guard SELECT (pool.query), then completion (pool.connect client).
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          data: {
            habitConfigs: { Walk: { days: [1], time: '07:00' } },
            reflectionConfig: { time: '21:00' },
          },
          current_step: 7,
        },
      ],
    });
    const calls = wireConnect(COMPLETING_STATE);
    const res = await confirmPlan({ anon_id: ANON }, {});
    expect(res).toEqual({ ok: true, result: { confirmed: true } });
    expect(calls.some((c) => /BEGIN/.test(c.sql))).toBe(true);
    expect(calls.some((c) => /COMMIT/.test(c.sql))).toBe(true);
    const update = calls.find((c) => /UPDATE onboarding_states\s+SET data/.test(c.sql))!;
    expect(update.sql).toContain("status = 'completed'");
  });

  it('rejects (handler_error) before completing when habits/reflection missing', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ data: { reflectionConfig: { time: '21:00' } }, current_step: 5 }],
    });
    const res = await confirmPlan({ anon_id: ANON }, {});
    expect(res).toMatchObject({ ok: false, error: 'handler_error' });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('re-confirm is idempotent success (already-completed row)', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          data: {
            habitConfigs: { Walk: { days: [1], time: '07:00' } },
            reflectionConfig: { time: '21:00' },
          },
          current_step: 8,
        },
      ],
    });
    wireConnect([
      { match: /SELECT status FROM onboarding_states/, rows: [{ status: 'completed' }] },
    ]);
    const res = await confirmPlan({ anon_id: ANON }, {});
    expect(res).toEqual({ ok: true, result: { confirmed: true } });
  });
});
