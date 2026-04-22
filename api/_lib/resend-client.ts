export interface EmailTag {
  name: string;
  value: string;
}

export interface EmailSendRequest {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: EmailTag[];
  headers?: Record<string, string>;
}

export interface EmailSendResult {
  ok: boolean;
  id?: string;
  status?: number;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 3000;

let missingConfigWarned = false;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendEmail(req: EmailSendRequest): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    if (!missingConfigWarned) {
      console.warn('resend_config_missing', {
        hasApiKey: Boolean(apiKey),
        hasFromEmail: Boolean(from),
      });
      missingConfigWarned = true;
    }
    return { ok: false };
  }

  const body: Record<string, unknown> = {
    from,
    to: req.to,
    subject: req.subject,
    html: req.html,
  };
  if (req.text) body.text = req.text;
  if (req.replyTo) body.reply_to = req.replyTo;
  if (req.tags) body.tags = req.tags;
  if (req.headers) body.headers = req.headers;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error('resend_send_failed', { status: response.status });
      return { ok: false, status: response.status };
    }

    const parsed = (await response.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: parsed?.id };
  } catch (err) {
    const name = err instanceof Error ? err.name : 'unknown';
    console.error('resend_send_error', { name });
    return { ok: false };
  }
}
