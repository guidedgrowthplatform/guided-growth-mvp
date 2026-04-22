import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { escapeHtml } from '../resend-client';

describe('escapeHtml', () => {
  it('escapes all five HTML-sensitive characters', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
    expect(escapeHtml("it's")).toBe('it&#39;s');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('is idempotent on safe input', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
    expect(escapeHtml('')).toBe('');
  });

  it('escapes & first so existing entities are re-escaped', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });
});

describe('sendEmail', () => {
  const ORIGINAL_ENV = { ...process.env };
  const fetchSpy = vi.fn();
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const REQ = {
    to: 'admin@example.com',
    subject: 'hi',
    html: '<p>hi</p>',
    text: 'hi',
  } as const;

  async function loadFresh() {
    vi.resetModules();
    return import('../resend-client');
  }

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('returns { ok: false } and does not call fetch when API key missing', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.RESEND_FROM_EMAIL = 'no-reply@example.com';
    const { sendEmail } = await loadFresh();
    const result = await sendEmail(REQ);
    expect(result).toEqual({ ok: false });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
  });

  it('warns only once across multiple calls with missing config', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.RESEND_FROM_EMAIL = 'no-reply@example.com';
    const { sendEmail } = await loadFresh();
    await sendEmail(REQ);
    await sendEmail(REQ);
    await sendEmail(REQ);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
  });

  it('returns { ok: false } when from-email missing', async () => {
    process.env.RESEND_API_KEY = 're_test';
    delete process.env.RESEND_FROM_EMAIL;
    const { sendEmail } = await loadFresh();
    const result = await sendEmail(REQ);
    expect(result).toEqual({ ok: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns { ok: true, id } on 200 with correct headers/body', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_FROM_EMAIL = 'no-reply@example.com';
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'msg_abc' }),
    });
    const { sendEmail } = await loadFresh();
    const result = await sendEmail(REQ);
    expect(result).toEqual({ ok: true, id: 'msg_abc' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer re_test');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.from).toBe('no-reply@example.com');
    expect(body.to).toBe('admin@example.com');
    expect(body.subject).toBe('hi');
  });

  it('translates replyTo → reply_to (snake_case) in request body', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_FROM_EMAIL = 'no-reply@example.com';
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'msg_abc' }),
    });
    const { sendEmail } = await loadFresh();
    await sendEmail({ ...REQ, replyTo: 'user@example.com' });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.reply_to).toBe('user@example.com');
    expect(body.replyTo).toBeUndefined();
  });

  it.each([401, 429, 500])(
    'returns { ok: false, status } on %i without leaking body',
    async (status) => {
      process.env.RESEND_API_KEY = 're_test';
      process.env.RESEND_FROM_EMAIL = 'no-reply@example.com';
      fetchSpy.mockResolvedValueOnce({ ok: false, status, json: async () => ({}) });
      const { sendEmail } = await loadFresh();
      const result = await sendEmail(REQ);
      expect(result).toEqual({ ok: false, status });
      const loggedArg = consoleErrorSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(loggedArg).toEqual({ status });
      expect(JSON.stringify(loggedArg)).not.toContain('<p>hi</p>');
    },
  );

  it('returns { ok: false } when fetch throws (e.g., TimeoutError)', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_FROM_EMAIL = 'no-reply@example.com';
    fetchSpy.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'TimeoutError' }));
    const { sendEmail } = await loadFresh();
    const result = await sendEmail(REQ);
    expect(result).toEqual({ ok: false });
    const loggedArg = consoleErrorSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(loggedArg).toEqual({ name: 'TimeoutError' });
  });
});
