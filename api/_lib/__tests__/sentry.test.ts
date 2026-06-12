import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  flush: vi.fn(() => Promise.resolve(true)),
  dedupeIntegration: vi.fn(() => ({})),
}));
vi.mock('@sentry/node', () => sentry);

// DSN must exist before the module under test loads (read at import time).
process.env.SENTRY_DSN = 'https://abc@o1.ingest.sentry.io/1';
const { reportToolFailure, reportRequestFailure, flushSentry } = await import('../sentry.js');

const lastCtx = (mock: { mock: { calls: unknown[][] } }) =>
  mock.mock.calls.at(-1)?.[1] as {
    user?: { id: string };
    tags: { tool: string; error_code: string };
    fingerprint: string[];
    extra: { args: string };
  };

beforeEach(() => {
  sentry.captureException.mockClear();
  sentry.captureMessage.mockClear();
  sentry.flush.mockClear();
});

afterEach(() => vi.restoreAllMocks());

describe('reportToolFailure', () => {
  it('captures hard failures as exceptions with tags, fingerprint, and user', () => {
    reportToolFailure({
      tool: 'create_habit',
      anonId: 'anon-123',
      errorCode: 'handler_error',
      args: { mood: 5 },
      error: new Error('db down'),
    });
    expect(sentry.captureException).toHaveBeenCalledOnce();
    const [err, ctx] = sentry.captureException.mock.calls[0];
    expect((err as Error).message).toBe('db down');
    expect(ctx.tags).toEqual({ tool: 'create_habit', error_code: 'handler_error' });
    expect(ctx.fingerprint).toEqual(['create_habit', 'handler_error']);
    expect(ctx.user).toEqual({ id: 'anon-123' });
  });

  it('redacts structured PII keys and scrubs free-text values', () => {
    reportToolFailure({
      tool: 'submit_profile',
      anonId: 'anon-1',
      errorCode: 'handler_error',
      args: { nickname: 'Sarah', age: 34, mood: 5, brain_dump_raw: 'my name is Bob' },
      error: new Error('x'),
    });
    const args = lastCtx(sentry.captureException).extra.args;
    expect(args).toContain('[REDACTED]'); // nickname + age
    expect(args).not.toContain('Sarah');
    expect(args).not.toContain('34');
    expect(args).toContain('"mood":5'); // scale values intact
    expect(args).not.toContain('Bob'); // free-text scrubbed
  });

  it('redacts PII nested in objects and arrays', () => {
    reportToolFailure({
      tool: 'submit_profile',
      anonId: 'a',
      errorCode: 'handler_error',
      args: { profile: { nickname: 'Sarah' }, people: [{ name: 'Bob' }], mood: 5 },
      error: new Error('x'),
    });
    const args = lastCtx(sentry.captureException).extra.args;
    expect(args).not.toContain('Sarah');
    expect(args).not.toContain('Bob');
    expect(args).toContain('[REDACTED]');
    expect(args).toContain('"mood":5');
  });

  it('reports non-sampled soft failures as a warning message', () => {
    reportToolFailure({ tool: 'create_habit', anonId: 'a', errorCode: 'validation', args: {} });
    expect(sentry.captureMessage).toHaveBeenCalledOnce();
    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.captureMessage.mock.calls[0][1].level).toBe('warning');
  });

  it('maps "missing"/falsy anonId to no user', () => {
    reportToolFailure({
      tool: 't',
      anonId: 'missing',
      errorCode: 'handler_error',
      error: new Error('y'),
    });
    expect(lastCtx(sentry.captureException).user).toBeUndefined();
  });

  it('samples unknown_tool/invalid_args (captured when random under rate)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    reportToolFailure({ tool: 'foo', anonId: 'a', errorCode: 'unknown_tool', args: {} });
    expect(sentry.captureMessage).toHaveBeenCalledOnce();
    expect(lastCtx(sentry.captureMessage).tags.error_code).toBe('unknown_tool');
  });

  it('drops sampled codes when random above rate', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    reportToolFailure({ tool: 'foo', anonId: 'a', errorCode: 'invalid_args', args: {} });
    expect(sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('never throws on unserializable args', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() =>
      reportToolFailure({
        tool: 't',
        anonId: 'a',
        errorCode: 'handler_error',
        args: circular,
        error: new Error('z'),
      }),
    ).not.toThrow();
    expect(lastCtx(sentry.captureException).extra.args).toContain('[Circular]');
  });
});

describe('reportRequestFailure', () => {
  it('captures as error level with a scope tag (not a tool tag)', () => {
    reportRequestFailure('llm', 'openai_error', 'anon-9');
    expect(sentry.captureMessage).toHaveBeenCalledOnce();
    const ctx = sentry.captureMessage.mock.calls[0][1];
    expect(ctx.level).toBe('error');
    expect(ctx.tags).toEqual({ scope: 'llm', error_code: 'openai_error' });
    expect(ctx.tags.tool).toBeUndefined();
  });
});

describe('flushSentry', () => {
  it('delegates to Sentry.flush', async () => {
    await flushSentry();
    expect(sentry.flush).toHaveBeenCalledOnce();
  });
});

describe('no DSN', () => {
  it('skips capture and flush entirely', async () => {
    vi.resetModules();
    const saved = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    const mod = await import('../sentry.js');
    sentry.captureException.mockClear();
    sentry.flush.mockClear();
    mod.reportToolFailure({
      tool: 't',
      anonId: 'a',
      errorCode: 'handler_error',
      error: new Error('e'),
    });
    await mod.flushSentry();
    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.flush).not.toHaveBeenCalled();
    process.env.SENTRY_DSN = saved;
    vi.resetModules();
  });
});
