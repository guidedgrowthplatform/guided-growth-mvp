/**
 * handleCors origin allowlist — pure unit test, mocked req/res.
 * Guards the QA web origin + per-app preview URLs without widening to all of *.vercel.app.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleCors } from '../cors';

function mockReq(origin: string, method = 'GET'): VercelRequest {
  return { headers: { origin }, method } as unknown as VercelRequest;
}

function mockRes(): VercelResponse & { headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  const res = {
    headers,
    setHeader: vi.fn((k: string, v: string) => {
      headers[k] = v;
    }),
    status: vi.fn(() => res),
    end: vi.fn(),
  };
  return res as unknown as VercelResponse & { headers: Record<string, string> };
}

const allowed = (origin: string) => {
  const res = mockRes();
  handleCors(mockReq(origin), res);
  return res.headers['Access-Control-Allow-Origin'];
};

afterEach(() => vi.restoreAllMocks());

describe('handleCors origin allowlist', () => {
  it('allows the prod web origin', () => {
    expect(allowed('https://guided-growth-mvp.vercel.app')).toBe('https://guided-growth-mvp.vercel.app');
  });

  it('allows the QA web origin', () => {
    expect(allowed('https://guided-growth-qa.vercel.app')).toBe('https://guided-growth-qa.vercel.app');
  });

  it('allows native Capacitor origins', () => {
    expect(allowed('capacitor://localhost')).toBe('capacitor://localhost');
    expect(allowed('https://localhost')).toBe('https://localhost');
  });

  it('allows preview URLs of both apps', () => {
    const mvp = 'https://guided-growth-mvp-git-staging-team.vercel.app';
    const qa = 'https://guided-growth-qa-git-staging-team.vercel.app';
    expect(allowed(mvp)).toBe(mvp);
    expect(allowed(qa)).toBe(qa);
  });

  it('rejects unrelated and look-alike *.vercel.app origins', () => {
    expect(allowed('https://evil-app.vercel.app')).toBeUndefined();
    // attacker-registerable names that must NOT pass credentialed CORS
    expect(allowed('https://evil-guided-growth-qa.vercel.app')).toBeUndefined();
    expect(allowed('https://guided-growth-mvp.evil.vercel.app')).toBeUndefined();
  });

  it('short-circuits OPTIONS preflight with 204 and sets the origin header', () => {
    const res = mockRes();
    const handled = handleCors(mockReq('https://guided-growth-qa.vercel.app', 'OPTIONS'), res);
    expect(handled).toBe(true);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://guided-growth-qa.vercel.app');
  });
});
