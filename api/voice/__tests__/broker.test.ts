import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../_lib/auth.js', () => ({
  handlePreflight: vi.fn(() => false),
  requireUser: vi.fn(async () => ({ anonId: 'anon-1', authUserId: 'user-1' })),
}));
vi.mock('../../_lib/db.js', () => ({ default: { query: vi.fn() } }));

const pool = (await import('../../_lib/db.js')).default as unknown as {
  query: ReturnType<typeof vi.fn>;
};
const broker = await import('../../_lib/voice/coachBroker.js');
const coachHost = await import('../../_lib/voice/coachHost.js');
const sessionHandler = (await import('../session.js')).default;
const toolHandler = (await import('../tool.js')).default;
const endHandler = (await import('../session/end.js')).default;

function response() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    setHeader: vi.fn(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res as typeof res & import('@vercel/node').VercelResponse;
}
function request(body: unknown) {
  return { method: 'POST', headers: {}, body } as unknown as import('@vercel/node').VercelRequest;
}
const activeBeat = {
  flowId: 'onboarding-beginner-v1',
  screenId: 'ONBOARD-01--FORM',
  allowedTools: ['submit_profile', 'advance_step'],
  completionRecipe: {
    captureTool: 'submit_profile',
    advanceTool: 'advance_step' as const,
    targetStep: 2,
  },
};

describe('voice broker security outcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('COACH_COMPONENT_ENABLED', 'true');
    vi.stubEnv('COACH_ENABLED_BEATS', 'onboarding-beginner-v1:ONBOARD-01--FORM');
    vi.stubEnv('COACH_CAPABILITY_SECRET', '01234567890123456789012345678901');
    vi.spyOn(broker, 'loadActiveBeat').mockResolvedValue(activeBeat);
    pool.query.mockResolvedValue({ rows: [] });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('returns only Daily connection material and keeps the capability server-side', async () => {
    const handoff = vi.spyOn(coachHost, 'handoffCoachSessionToHost').mockResolvedValue({
      roomUrl: 'https://gg-coach.daily.co/test',
      token: 'daily-token',
    });
    const res = response();
    await sessionHandler(request({ surface: 'onboarding' }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({
      roomUrl: 'https://gg-coach.daily.co/test',
      token: 'daily-token',
    });
    expect(res.body).not.toHaveProperty('capability');
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO coach_sessions/),
      expect.arrayContaining(['anon-1', 'ONBOARD-01--FORM']),
    );
    expect(handoff).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: expect.any(String),
        capability: expect.any(String),
        effectiveProfile: expect.any(Object),
      }),
    );
    expect(broker.verifyCapability(handoff.mock.calls[0][0].capability)).toMatchObject({
      anonId: 'anon-1',
      screenId: 'ONBOARD-01--FORM',
    });
  });

  it('fails the persisted session before tearing down a host that activated after a lost handoff response', async () => {
    const handoff = vi
      .spyOn(coachHost, 'handoffCoachSessionToHost')
      .mockRejectedValue(new Error('coach_host_unavailable'));
    const fail = vi.spyOn(coachHost, 'failCoachSessionBeforeHostTeardown');
    const teardown = vi.spyOn(coachHost, 'endCoachSessionOnHost').mockResolvedValue();
    const res = response();

    await sessionHandler(request({ surface: 'onboarding' }), res);

    const sessionId = handoff.mock.calls[0][0].sessionId;
    expect(res.statusCode).toBe(503);
    expect(fail).toHaveBeenCalledWith(sessionId);
    expect(teardown).toHaveBeenCalledWith(sessionId);
    expect(fail.mock.invocationCallOrder[0]).toBeLessThan(teardown.mock.invocationCallOrder[0]);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringMatching(/SET state = 'failed'[\s\S]*host_handoff_failed/),
      [sessionId],
    );
  });

  it('tears down the host and surfaces the error when marking a lost handoff failed rejects', async () => {
    const handoff = vi
      .spyOn(coachHost, 'handoffCoachSessionToHost')
      .mockRejectedValue(new Error('coach_host_unavailable'));
    const failedStateUpdateError = new Error('coach_session_failed_update_error');
    const fail = vi
      .spyOn(coachHost, 'failCoachSessionBeforeHostTeardown')
      .mockRejectedValue(failedStateUpdateError);
    const teardown = vi.spyOn(coachHost, 'endCoachSessionOnHost').mockResolvedValue();
    const res = response();

    await sessionHandler(request({ surface: 'onboarding' }), res);

    const sessionId = handoff.mock.calls[0][0].sessionId;
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'coach_session_failed_update_error' });
    expect(fail).toHaveBeenCalledWith(sessionId);
    expect(teardown).toHaveBeenCalledWith(sessionId);
    expect(fail.mock.invocationCallOrder[0]).toBeLessThan(teardown.mock.invocationCallOrder[0]);
  });

  it('admits ONBOARD-01--FORM from the persisted matching active flow selection', async () => {
    vi.spyOn(coachHost, 'handoffCoachSessionToHost').mockResolvedValue({
      roomUrl: 'https://gg-coach.daily.co/test',
      token: 'daily-token',
    });
    vi.mocked(broker.loadActiveBeat).mockRestore();
    pool.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT current_step, path, status, data FROM onboarding_states')) {
        return {
          rows: [
            {
              current_step: 1,
              path: null,
              status: 'in_progress',
              data: { flowId: 'onboarding-beginner-v1', flowVersion: 'onboarding-beginner-v1@v1' },
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO coach_sessions')) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    });

    const res = response();
    await sessionHandler(request({ surface: 'onboarding' }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({
      sessionId: expect.any(String),
      roomUrl: 'https://gg-coach.daily.co/test',
      token: 'daily-token',
    });
    expect(res.body).not.toHaveProperty('capability');
    const handoff = vi.mocked(coachHost.handoffCoachSessionToHost).mock.calls[0][0];
    expect(broker.verifyCapability(handoff.capability)).toMatchObject({
      anonId: 'anon-1',
      screenId: 'ONBOARD-01--FORM',
      allowedTools: ['submit_profile', 'advance_step'],
    });
  });

  it('rejects a beat mismatch and leaves no session side effect', async () => {
    vi.spyOn(broker, 'loadActiveBeat').mockResolvedValue(null);
    const res = response();
    await sessionHandler(
      request({ surface: 'onboarding', flowId: 'attacker-flow', screenId: 'attacker-screen' }),
      res,
    );
    expect(res.statusCode).toBe(403);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects dispatch from a creating session', async () => {
    const capability = broker.issueCapability({
      sessionId: 'session-1',
      anonId: 'anon-1',
      screenId: activeBeat.screenId,
      allowedTools: activeBeat.allowedTools,
      jti: 'jti-1',
    });
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          anon_id: 'anon-1',
          flow_id: activeBeat.flowId,
          screen_id: activeBeat.screenId,
          state: 'creating',
          capability_jti: 'jti-1',
          allowed_tools: activeBeat.allowedTools,
          completion_recipe: activeBeat.completionRecipe,
        },
      ],
    });
    const dispatch = vi.spyOn(broker, 'runBoundOnboardingTool');
    const creating = response();
    await toolHandler(request({ capability, name: 'submit_profile', args: {} }), creating);
    expect(creating.statusCode).toBe(403);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('rejects a stale beat and a non-allowlisted tool before dispatch', async () => {
    const capability = broker.issueCapability({
      sessionId: 'session-1',
      anonId: 'anon-1',
      screenId: activeBeat.screenId,
      allowedTools: activeBeat.allowedTools,
      jti: 'jti-1',
    });
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          anon_id: 'anon-1',
          flow_id: activeBeat.flowId,
          screen_id: activeBeat.screenId,
          state: 'active',
          capability_jti: 'jti-1',
          allowed_tools: activeBeat.allowedTools,
          completion_recipe: activeBeat.completionRecipe,
        },
      ],
    });
    vi.spyOn(broker, 'loadActiveBeat').mockResolvedValue({
      ...activeBeat,
      screenId: 'ONBOARD-FORK--FORM',
    });
    const stale = response();
    await toolHandler(request({ capability, name: 'submit_profile', args: {} }), stale);
    expect(stale.statusCode).toBe(403);

    vi.spyOn(broker, 'loadActiveBeat').mockResolvedValue(activeBeat);
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          anon_id: 'anon-1',
          flow_id: activeBeat.flowId,
          screen_id: activeBeat.screenId,
          state: 'active',
          capability_jti: 'jti-1',
          allowed_tools: ['submit_profile'],
          completion_recipe: activeBeat.completionRecipe,
        },
      ],
    });
    const forbidden = response();
    await toolHandler(
      request({ capability, name: 'advance_step', args: { target_step: 2 } }),
      forbidden,
    );
    expect(forbidden.statusCode).toBe(403);
  });

  it('revokes an existing capability when the live beat flag is disabled', async () => {
    const capability = broker.issueCapability({
      sessionId: 'session-1',
      anonId: 'anon-1',
      screenId: activeBeat.screenId,
      allowedTools: activeBeat.allowedTools,
      jti: 'jti-1',
    });
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          anon_id: 'anon-1',
          flow_id: activeBeat.flowId,
          screen_id: activeBeat.screenId,
          state: 'active',
          capability_jti: 'jti-1',
          allowed_tools: activeBeat.allowedTools,
          completion_recipe: activeBeat.completionRecipe,
        },
      ],
    });
    vi.stubEnv('COACH_ENABLED_BEATS', '');
    const dispatch = vi.spyOn(broker, 'runBoundOnboardingTool');

    const res = response();
    await toolHandler(request({ capability, name: 'submit_profile', args: { age: '30' } }), res);

    expect(res.statusCode).toBe(403);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('allows host acknowledgment only through the server library and then dispatches', async () => {
    const capability = broker.issueCapability({
      sessionId: 'session-1',
      anonId: 'anon-1',
      screenId: activeBeat.screenId,
      allowedTools: activeBeat.allowedTools,
      jti: 'jti-1',
    });
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await expect(coachHost.acknowledgeCoachHostActive('session-1', capability)).resolves.toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringMatching(
        /UPDATE coach_sessions[\s\S]*state = 'active'[\s\S]*state = 'spawning'/,
      ),
      expect.arrayContaining(['session-1', 'anon-1', activeBeat.screenId, 'jti-1']),
    );

    const dispatch = vi
      .spyOn(broker, 'runBoundOnboardingTool')
      .mockResolvedValue({ result: { ok: true }, readBack: { anon_id: 'anon-1' } } as never);
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          anon_id: 'anon-1',
          flow_id: activeBeat.flowId,
          screen_id: activeBeat.screenId,
          state: 'active',
          capability_jti: 'jti-1',
          allowed_tools: activeBeat.allowedTools,
          completion_recipe: activeBeat.completionRecipe,
        },
      ],
    });
    const res = response();
    await toolHandler(request({ capability, name: 'submit_profile', args: { age: '30' } }), res);
    expect(res.statusCode).toBe(200);
    expect(dispatch).toHaveBeenCalledOnce();
  });

  it('passes the server-owned capture then advance recipe to tool dispatch', async () => {
    const capability = broker.issueCapability({
      sessionId: 'session-1',
      anonId: 'anon-1',
      screenId: activeBeat.screenId,
      allowedTools: activeBeat.allowedTools,
      jti: 'jti-1',
    });
    const dispatch = vi.spyOn(broker, 'runBoundOnboardingTool').mockResolvedValue({
      result: { ok: true },
      readBack: { anon_id: 'anon-1', current_step: 2 },
    } as never);
    const row = {
      anon_id: 'anon-1',
      flow_id: activeBeat.flowId,
      screen_id: activeBeat.screenId,
      state: 'active',
      capability_jti: 'jti-1',
      allowed_tools: activeBeat.allowedTools,
      completion_recipe: activeBeat.completionRecipe,
    };
    pool.query.mockResolvedValueOnce({ rows: [row] });
    const capture = response();
    await toolHandler(
      request({ capability, name: 'submit_profile', args: { age: '30', gender: 'Other' } }),
      capture,
    );
    expect(capture.statusCode).toBe(200);

    pool.query.mockResolvedValueOnce({ rows: [row] });
    const advance = response();
    await toolHandler(
      request({ capability, name: 'advance_step', args: { target_step: 2 } }),
      advance,
    );
    expect(advance.statusCode).toBe(200);
    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'submit_profile',
      expect.anything(),
      expect.objectContaining({ completionRecipe: activeBeat.completionRecipe }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'advance_step',
      { target_step: 2 },
      expect.objectContaining({ completionRecipe: activeBeat.completionRecipe }),
    );
  });

  it('rejects wrong-owner end and is idempotent for the owner', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ anon_id: 'anon-2', state: 'creating' }] });
    const wrongOwner = response();
    await endHandler(request({ sessionId: 'session-1' }), wrongOwner);
    expect(wrongOwner.statusCode).toBe(404);

    pool.query.mockResolvedValueOnce({ rows: [{ id: 'session-1', state: 'ended' }] });
    const own = response();
    await endHandler(request({ sessionId: 'session-1' }), own);
    expect(own.body).toEqual({ ended: true, alreadyEnded: false });
  });

  it('flag off returns not found without invoking existing onboarding paths', async () => {
    vi.stubEnv('COACH_COMPONENT_ENABLED', 'false');
    const res = response();
    await sessionHandler(request({ surface: 'onboarding' }), res);
    expect(res.statusCode).toBe(404);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
