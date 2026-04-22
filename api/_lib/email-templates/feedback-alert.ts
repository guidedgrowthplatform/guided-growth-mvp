import { escapeHtml } from '../resend-client.js';

export type FeedbackSentiment = 'love' | 'ok' | 'needs-work';

export interface FeedbackAlertInput {
  sentiment: FeedbackSentiment;
  text: string;
  userEmail: string;
  submittedAt: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const SENTIMENT_LABEL: Record<FeedbackSentiment, string> = {
  love: 'Loves it',
  ok: "It's OK",
  'needs-work': 'Needs work',
};

export function renderFeedbackAlert(input: FeedbackAlertInput): RenderedEmail {
  const label = SENTIMENT_LABEL[input.sentiment];
  const subject = `[Feedback · ${label}] from ${input.userEmail}`;

  const safeSentiment = escapeHtml(label);
  const safeUserEmail = escapeHtml(input.userEmail);
  const safeSubmittedAt = escapeHtml(input.submittedAt);
  const safeText = escapeHtml(input.text || '(no text)').replace(/\n/g, '<br>');

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;background:#f6f6f6;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;border:1px solid #e5e5e5;">
    <h1 style="margin:0 0 8px;font-size:18px;font-weight:600;">New feedback</h1>
    <p style="margin:0 0 16px;color:#555;font-size:14px;">${safeSentiment}</p>
    <div style="padding:16px;background:#fafafa;border-radius:6px;border:1px solid #eee;font-size:15px;line-height:1.5;">
      ${safeText}
    </div>
    <table style="margin-top:20px;font-size:13px;color:#666;border-collapse:collapse;">
      <tr><td style="padding:4px 12px 4px 0;">From</td><td style="padding:4px 0;">${safeUserEmail}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;">Submitted</td><td style="padding:4px 0;">${safeSubmittedAt}</td></tr>
    </table>
  </div>
</body>
</html>`;

  const text = [
    `New feedback — ${label}`,
    '',
    input.text || '(no text)',
    '',
    `From: ${input.userEmail}`,
    `Submitted: ${input.submittedAt}`,
  ].join('\n');

  return { subject, html, text };
}
