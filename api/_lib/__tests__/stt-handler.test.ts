/**
 * Request/response unit tests for POST /api/stt. No Soniox calls — global
 * fetch is stubbed. Covers the three Path-2 STT hardening fixes:
 *  (b) method check before rate-limit, (a) generic error message.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth.js', () => ({
  requireUser: vi.fn(),
  handlePreflight: vi.fn(() => false),
}));
vi.mock('../rate-limit.js', () => ({
  checkRateLimit: vi.fn(() => ({ limited: false })),
}));

const auth = await import('../auth.js');
const rateLimit = await import('../rate-limit.js');
const handler = (await import('../../stt.js')).default;

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
    send(body: unknown) {
      this._body = body;
      return this as VercelResponse;
    },
    setHeader: vi.fn(),
  };
  return res as VercelResponse & { _status: number; _body: unknown };
}

// Multipart body with a single file part; emitted over the req stream.
function multipartReq(): VercelRequest {
  const boundary = 'X-BOUNDARY';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from('Content-Disposition: form-data; name="file"; filename="r.wav"\r\n'),
    Buffer.from('Content-Type: audio/wav\r\n\r\n'),
    Buffer.from([0x52, 0x49, 0x46, 0x46]),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const req = new EventEmitter() as unknown as VercelRequest & EventEmitter;
  req.method = 'POST';
  req.headers = { 'content-type': `multipart/form-data; boundary=${boundary}` };
  // Emit on next tick so the handler's listeners are attached first.
  setImmediate(() => {
    req.emit('data', body);
    req.emit('end');
  });
  return req as VercelRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  (auth.requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    authUserId: 'user-A',
    anonId: 'anon-A',
    firstName: null,
    email: 'a@example.com',
    role: 'user',
    status: 'active',
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('POST /api/stt', () => {
  it('returns 405 on GET without consuming a rate-limit token (fix b)', async () => {
    const req = { method: 'GET', headers: {} } as unknown as VercelRequest;
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(405);
    expect(rateLimit.checkRateLimit).not.toHaveBeenCalled();
    expect(auth.requireUser).not.toHaveBeenCalled();
  });

  it('short-circuits when requireUser writes 401 (auth runs, bypass off)', async () => {
    vi.stubEnv('AUTH_BYPASS_MODE', '');
    (auth.requireUser as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_req: VercelRequest, res: VercelResponse) => {
        res.status(401).json({ error: 'Authentication required' });
        return null;
      },
    );
    const req = { method: 'POST', headers: {} } as unknown as VercelRequest;
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(401);
    expect(rateLimit.checkRateLimit).not.toHaveBeenCalled();
  });

  it('returns generic "Transcription failed" when upstream fetch throws (fix a)', async () => {
    vi.stubEnv('AUTH_BYPASS_MODE', '');
    vi.stubEnv('SONIOX_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('socket hang up — leaks raw details');
      }),
    );
    const res = mockRes();
    await handler(multipartReq(), res);
    expect(res._status).toBe(500);
    expect((res._body as { error: string }).error).toBe('Transcription failed');
  });
});
