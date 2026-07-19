import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const client = {
  query: vi.fn(),
  release: vi.fn(),
};
const connect = vi.fn(async () => client);
vi.mock('../../db.js', () => ({ default: { connect, query: vi.fn() } }));

const broker = await import('../coachBroker.js');
const pool = (await import('../../db.js')).default as unknown as {
  query: ReturnType<typeof vi.fn>;
};

describe('coach capability and RLS transaction boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('COACH_CAPABILITY_SECRET', '01234567890123456789012345678901');
    client.query.mockResolvedValue({ rows: [] });
    pool.query.mockResolvedValue({ rows: [] });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('issues fresh capabilities and rejects expired or tampered ones', async () => {
    const capability = broker.issueCapability({
      sessionId: 'session-1',
      anonId: 'anon-1',
      screenId: 'ONBOARD-01--FORM',
      allowedTools: ['submit_profile'],
      jti: 'jti-1',
    });
    expect(broker.verifyCapability(capability)).toMatchObject({
      sessionId: 'session-1',
      anonId: 'anon-1',
    });
    expect(broker.verifyCapability(`${capability}x`)).toBeNull();

    const payload = Buffer.from(
      JSON.stringify({
        iss: 'gg-app',
        aud: 'gg-coach-host',
        sessionId: 's',
        anonId: 'anon-1',
        screenId: 'beat',
        allowedTools: [],
        jti: 'j',
        exp: 1,
      }),
    ).toString('base64url');
    const crypto = await import('node:crypto');
    const expired = `${payload}.${crypto.createHmac('sha256', process.env.COACH_CAPABILITY_SECRET!).update(payload).digest('base64url')}`;
    expect(broker.verifyCapability(expired)).toBeNull();
  });

  it('rejects an active state pinned to a different persisted flow id', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { current_step: 1, path: null, status: 'in_progress', data: { flowId: 'other-flow-v1' } },
      ],
    });

    await expect(broker.loadActiveBeat('anon-1')).resolves.toBeNull();
  });

  it('admits the generated coach beat from a matching persisted active flow selection', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          current_step: 1,
          path: null,
          status: 'in_progress',
          data: { flowId: 'onboarding-beginner-v1', flowVersion: 'onboarding-beginner-v1@v1' },
        },
      ],
    });

    await expect(broker.loadActiveBeat('anon-1')).resolves.toMatchObject({
      flowId: 'onboarding-beginner-v1',
      screenId: 'ONBOARD-01--FORM',
      allowedTools: ['submit_profile', 'advance_step'],
      completionRecipe: {
        captureTool: 'submit_profile',
        advanceTool: 'advance_step',
        targetStep: 2,
      },
    });
  });

  it('admits ONBOARD-BEGINNER-01 with its category capture recipe', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          current_step: 3,
          path: 'path-3-direct-llm',
          status: 'in_progress',
          data: { flowId: 'onboarding-beginner-v1' },
        },
      ],
    });

    await expect(broker.loadActiveBeat('anon-1')).resolves.toMatchObject({
      flowId: 'onboarding-beginner-v1',
      screenId: 'ONBOARD-BEGINNER-01',
      allowedTools: ['submit_category', 'advance_step'],
      completionRecipe: {
        captureTool: 'submit_category',
        advanceTool: 'advance_step',
        targetStep: 4,
      },
    });
  });

  it('enforces the server-owned profile capture before its advance target', () => {
    const recipe = {
      captureTool: 'submit_profile',
      advanceTool: 'advance_step' as const,
      targetStep: 2,
    };
    expect(broker.validateRecipeTransition(recipe, {}, 'advance_step', { target_step: 2 })).toBe(
      false,
    );
    expect(
      broker.validateRecipeTransition(recipe, { captured: true }, 'advance_step', {
        target_step: 3,
      }),
    ).toBe(false);
    expect(
      broker.validateRecipeTransition(recipe, { captured: true }, 'advance_step', {
        target_step: 2,
      }),
    ).toBe(true);
  });

  it('rejects advance before capture and accepts the persisted capture then advance order', async () => {
    const claims = {
      sessionId: 'session-1',
      anonId: 'anon-1',
      screenId: 'ONBOARD-01--FORM',
      allowedTools: ['submit_profile', 'advance_step'],
      jti: 'jti-1',
    } as const;
    const session = {
      flowId: 'onboarding-beginner-v1',
      allowedTools: ['submit_profile', 'advance_step'],
      completionRecipe: {
        captureTool: 'submit_profile',
        advanceTool: 'advance_step' as const,
        targetStep: 2,
      },
    };
    let captured = false;
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT recipe_progress'))
        return { rows: [{ recipe_progress: captured ? { captured: true } : {} }] };
      if (sql.includes('SET recipe_progress')) {
        captured = true;
        return { rows: [] };
      }
      if (sql.startsWith('SELECT anon_id, current_step'))
        return { rows: [{ anon_id: 'anon-1', current_step: 2 }] };
      return { rows: [] };
    });

    await expect(
      broker.runBoundOnboardingTool(claims, 'advance_step', { target_step: 2 }, session),
    ).rejects.toThrow('recipe_order_violation');
    await expect(
      broker.runBoundOnboardingTool(
        claims,
        'submit_profile',
        { age: '30', gender: 'Other' },
        session,
      ),
    ).resolves.toMatchObject({ readBack: { anon_id: 'anon-1' } });
    await expect(
      broker.runBoundOnboardingTool(claims, 'advance_step', { target_step: 2 }, session),
    ).resolves.toMatchObject({ readBack: { anon_id: 'anon-1' } });
  });

  it('rejects a session ended between route validation and the locked transaction query', async () => {
    const claims = {
      sessionId: 'session-1',
      anonId: 'anon-1',
      screenId: 'ONBOARD-01--FORM',
      allowedTools: ['submit_profile'],
      jti: 'jti-1',
    } as const;
    const session = {
      flowId: 'onboarding-beginner-v1',
      allowedTools: ['submit_profile'],
      completionRecipe: {
        captureTool: 'submit_profile',
        advanceTool: 'advance_step' as const,
        targetStep: 2,
      },
    };
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT recipe_progress')) return { rows: [] };
      return { rows: [] };
    });

    await expect(
      broker.runBoundOnboardingTool(claims, 'submit_profile', { age: '30' }, session),
    ).rejects.toThrow('session_not_active');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/capability_jti = \$5 AND state = 'active'\s+FOR UPDATE/),
      expect.any(Array),
    );
  });

  it('sets authenticated JWT claims on a checked-out transaction client and confines reads to its anon id', async () => {
    let boundAnon: string | null = null;
    const rows = new Map<string, { anon_id: string; value: string }>();
    client.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("set_config('request.jwt.claims'")) {
        boundAnon = JSON.parse(params?.[0] as string).anon_id;
        return { rows: [] };
      }
      if (sql === 'WRITE') {
        rows.set(boundAnon!, { anon_id: boundAnon!, value: params?.[0] as string });
        return { rows: [] };
      }
      if (sql === 'READ') return { rows: rows.has(boundAnon!) ? [rows.get(boundAnon!)] : [] };
      if (sql === 'CROSS_READ')
        return { rows: [...rows.values()].filter((row) => row.anon_id === boundAnon) };
      return { rows: [] };
    });

    const own = await broker.withRlsBoundTransaction('anon-1', async (db) => {
      await db.query('WRITE', ['captured-by-tool']);
      return db.query('READ');
    });
    const cross = await broker.withRlsBoundTransaction('anon-2', (db) => db.query('CROSS_READ'));

    expect(own.rows).toEqual([{ anon_id: 'anon-1', value: 'captured-by-tool' }]);
    expect(cross.rows).toEqual([]);
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('SET LOCAL ROLE authenticated');
    expect(client.release).toHaveBeenCalledTimes(2);
  });
});
