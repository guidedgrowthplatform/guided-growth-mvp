import type { VercelRequest, VercelResponse } from '@vercel/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth.js', () => ({
  requireUserNoDb: vi.fn(),
  handlePreflight: vi.fn(() => false),
}));
vi.mock('../rate-limit.js', () => ({
  checkRateLimit: vi.fn(() => ({ limited: false })),
}));

const auth = await import('../auth.js');
const rateLimit = await import('../rate-limit.js');
const handler = (await import('../../cartesia-token.js')).default;

function mockRes() {
  const res: Partial<VercelResponse> & { _status: number; _body: unknown } = {
    _status: 0,
    _body: undefined,
    status(code: number) {
      this._status = code;
      return this as VercelResponse;
    },
    json(body: unknown) {
      this._body = body;
      return this as VercelResponse;
    },
    setHeader: vi.fn(),
  };
  return res as VercelResponse & { _status: number; _body: unknown };
}

function mockReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    body: {},
    headers: {},
    ...overrides,
  } as unknown as VercelRequest;
}

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  (rateLimit.checkRateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    limited: false,
  });
  (auth.requireUserNoDb as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    authUserId: 'user-A',
    status: 'active',
  });
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('AUTH_BYPASS_MODE', '');
  vi.stubEnv('CARTESIA_API_KEY', 'real-secret-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  process.env = { ...ORIG_ENV };
});

describe('POST /api/cartesia-token', () => {
  it('returns 405 on GET and never checks rate limit', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(405);
    expect(rateLimit.checkRateLimit).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is rejected (no fetch, no rate-limit)', async () => {
    (auth.requireUserNoDb as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_req: VercelRequest, res: VercelResponse) => {
        res.status(401).json({ error: 'Authentication required', code: 'invalid_token' });
        return null;
      },
    );
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const req = mockReq();
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(401);
    expect(rateLimit.checkRateLimit).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 503 when auth is unavailable (no fetch, no rate-limit)', async () => {
    (auth.requireUserNoDb as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_req: VercelRequest, res: VercelResponse) => {
        res
          .status(503)
          .json({ error: 'Authentication temporarily unavailable', code: 'auth_unavailable' });
        return null;
      },
    );
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const req = mockReq();
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(503);
    expect(rateLimit.checkRateLimit).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 403 when the account is disabled (no fetch, no rate-limit)', async () => {
    (auth.requireUserNoDb as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_req: VercelRequest, res: VercelResponse) => {
        res.status(403).json({ error: 'Account disabled' });
        return null;
      },
    );
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const req = mockReq();
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(403);
    expect(rateLimit.checkRateLimit).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('mints an access token and returns { accessToken, expiresIn }', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ token: 'ct_abc' }),
    }));
    vi.stubGlobal('fetch', fetchSpy);
    const req = mockReq();
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toEqual({ accessToken: 'ct_abc', expiresIn: 60 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.grants).toEqual({ tts: true });
  });

  it('falls back to access_token when the mint names the field that way', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: 'ct_xyz' }),
    }));
    vi.stubGlobal('fetch', fetchSpy);
    const req = mockReq();
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toEqual({ accessToken: 'ct_xyz', expiresIn: 60 });
  });

  it('returns 502 when Cartesia responds ok but without a token', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
    }));
    vi.stubGlobal('fetch', fetchSpy);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const req = mockReq();
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(502);
    expect(res._body).toEqual({ error: 'TTS token failed' });
    errSpy.mockRestore();
  });

  it('returns 502 on Cartesia non-OK and does not leak the raw body', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => 'cartesia-secret-error-detail',
    }));
    vi.stubGlobal('fetch', fetchSpy);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const req = mockReq();
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(502);
    expect(res._body).toEqual({ error: 'TTS token failed' });
    expect(JSON.stringify(res._body)).not.toContain('cartesia-secret-error-detail');
    errSpy.mockRestore();
  });
});
