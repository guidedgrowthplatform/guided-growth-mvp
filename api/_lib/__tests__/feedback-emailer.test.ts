import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));

vi.mock('../resend-client.js', async () => {
  const actual = await vi.importActual<typeof import('../resend-client')>('../resend-client');
  return {
    ...actual,
    sendEmail: sendEmailMock,
  };
});

const BASE_INPUT = {
  feedbackId: 'fb_1',
  sentiment: 'love' as const,
  text: 'great app',
  userEmail: 'user@example.com',
  submittedAt: '2026-05-01T12:00:00.000Z',
};

describe('dispatchFeedbackAlert', () => {
  const ORIGINAL_ENV = { ...process.env };
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    sendEmailMock.mockReset();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('skips send and warns when FEEDBACK_ALERT_TO is unset', async () => {
    delete process.env.FEEDBACK_ALERT_TO;
    const { dispatchFeedbackAlert } = await import('../feedback-emailer');
    await dispatchFeedbackAlert(BASE_INPUT);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith('feedback_email_skipped', {
      reason: 'no_recipients',
    });
  });

  it('skips send when FEEDBACK_ALERT_TO is whitespace/empties only', async () => {
    process.env.FEEDBACK_ALERT_TO = '  ,, ';
    const { dispatchFeedbackAlert } = await import('../feedback-emailer');
    await dispatchFeedbackAlert(BASE_INPUT);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith('feedback_email_skipped', {
      reason: 'no_recipients',
    });
  });

  it('sends to all parsed recipients with rendered template and tags on success', async () => {
    process.env.FEEDBACK_ALERT_TO = 'a@x.com, b@x.com';
    sendEmailMock.mockResolvedValueOnce({ ok: true, id: 're_1' });
    const { dispatchFeedbackAlert } = await import('../feedback-emailer');
    await dispatchFeedbackAlert(BASE_INPUT);

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const arg = sendEmailMock.mock.calls[0][0];
    expect(arg.to).toEqual(['a@x.com', 'b@x.com']);
    expect(arg.replyTo).toBe('user@example.com');
    expect(arg.subject).toBe('[Feedback · Loves it] from user@example.com');
    expect(arg.html).toContain('great app');
    expect(arg.text).toContain('great app');
    expect(arg.tags).toEqual([
      { name: 'kind', value: 'feedback_alert' },
      { name: 'sentiment', value: 'love' },
    ]);

    expect(consoleLogSpy).toHaveBeenCalledWith('feedback_email_sent', {
      feedbackId: 'fb_1',
      resendId: 're_1',
    });
  });

  it('logs failure and does not throw when sendEmail returns ok:false', async () => {
    process.env.FEEDBACK_ALERT_TO = 'a@x.com';
    sendEmailMock.mockResolvedValueOnce({ ok: false, status: 500 });
    const { dispatchFeedbackAlert } = await import('../feedback-emailer');
    await expect(dispatchFeedbackAlert(BASE_INPUT)).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith('feedback_email_failed', {
      feedbackId: 'fb_1',
      status: 500,
    });
  });

  it('logs failure and does not throw when sendEmail rejects', async () => {
    process.env.FEEDBACK_ALERT_TO = 'a@x.com';
    sendEmailMock.mockRejectedValueOnce(Object.assign(new Error('boom'), { name: 'BoomError' }));
    const { dispatchFeedbackAlert } = await import('../feedback-emailer');
    await expect(dispatchFeedbackAlert(BASE_INPUT)).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith('feedback_email_failed', {
      feedbackId: 'fb_1',
      name: 'BoomError',
    });
  });
});
