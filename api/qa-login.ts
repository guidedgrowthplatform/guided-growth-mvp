// POST /api/qa-login — staging-only. Mints a one-time token for a QA account;
// caller adopts via verifyOtp. Boundary: QA_SURFACE_ENABLED + allowlist + rate limit.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePreflight } from './_lib/auth.js';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { getClientIp } from './_lib/validation.js';

const QA_LOGIN_EMAILS = new Set([
  'qa-mintesnot@guidedgrowth.test',
  'qa-yonas@guidedgrowth.test',
  'qa-yair@guidedgrowth.test',
  'qa-timothy@guidedgrowth.test',
  'qa-alejandro@guidedgrowth.test',
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 404 (not 403) so the endpoint looks nonexistent in production.
  if (process.env.QA_SURFACE_ENABLED !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }

  const sourceIp = getClientIp(req.headers);
  const rl = checkRateLimit(sourceIp, {
    windowMs: 60 * 60 * 1000,
    maxRequests: 30,
    keyPrefix: 'qa-login-ip',
  });
  if (rl.limited) {
    if (rl.retryAfter !== undefined) res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  const email = (req.body?.email ?? '').toString().toLowerCase().trim();
  if (!QA_LOGIN_EMAILS.has(email)) {
    logEvent({ sourceIp, success: false, reason: 'invalid_email' });
    return res.status(400).json({ error: 'Not a QA login account' });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    const hashedToken = data?.properties?.hashed_token;
    if (error || !hashedToken) {
      logEvent({ sourceIp, success: false, reason: 'generate_link_failed', email });
      return res.status(500).json({ error: 'Could not mint session', message: error?.message });
    }

    logEvent({ sourceIp, success: true, email });
    return res.status(200).json({ ok: true, email, hashed_token: hashedToken });
  } catch (err) {
    const e = err as { message?: string };
    logEvent({ sourceIp, success: false, reason: 'exception', email, error: e.message });
    return res.status(500).json({ error: 'Login failed', message: e.message ?? String(err) });
  }
}

function logEvent(fields: {
  sourceIp: string;
  success: boolean;
  reason?: string;
  email?: string;
  error?: string;
}) {
  console.info(
    JSON.stringify({
      event: 'qa_login',
      source_ip: fields.sourceIp,
      success: fields.success,
      reason: fields.reason,
      email: fields.email,
      error_message: fields.error,
      timestamp: new Date().toISOString(),
    }),
  );
}
