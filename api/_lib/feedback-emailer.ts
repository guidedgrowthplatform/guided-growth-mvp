import { sendEmail } from './resend-client.js';
import { renderFeedbackAlert, type FeedbackSentiment } from './email-templates/feedback-alert.js';

export interface DispatchFeedbackAlertInput {
  feedbackId: string;
  sentiment: FeedbackSentiment;
  text: string;
  userEmail: string;
  submittedAt: string;
}

function parseRecipients(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function dispatchFeedbackAlert(input: DispatchFeedbackAlertInput): Promise<void> {
  const { feedbackId, sentiment, text, userEmail, submittedAt } = input;

  const recipients = parseRecipients(process.env.FEEDBACK_ALERT_TO);
  if (recipients.length === 0) {
    console.warn('feedback_email_skipped', { reason: 'no_recipients' });
    return;
  }

  try {
    const rendered = renderFeedbackAlert({ sentiment, text, userEmail, submittedAt });
    const result = await sendEmail({
      to: recipients,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: userEmail,
      tags: [
        { name: 'kind', value: 'feedback_alert' },
        { name: 'sentiment', value: sentiment },
      ],
    });

    if (result.ok) {
      console.log('feedback_email_sent', { feedbackId, resendId: result.id });
    } else {
      console.error('feedback_email_failed', { feedbackId, status: result.status });
    }
  } catch (err) {
    const name = err instanceof Error ? err.name : 'unknown';
    console.error('feedback_email_failed', { feedbackId, name });
  }
}
