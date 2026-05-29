/**
 * Vapi webhook channel-auth.
 *
 * Vapi echoes `X-Vapi-Secret` on every tool/event webhook — the value is whatever
 * `server.secret` was set on the tool at registration time. We compare against
 * `process.env.VAPI_WEBHOOK_SECRET` in constant time. Mismatch → 401, no DB touch.
 *
 * NOTE: This is channel auth only. Identity (`anon_id`) flows via tool arguments,
 * injected server-side by Vapi from the call's `assistantOverrides.variableValues`.
 * See api/_lib/vapi/handlers/submitProfile.ts for the identity validation.
 */
import type { VercelRequest } from '@vercel/node';
import { timingSafeEqual } from 'crypto';

export type SecretCheck =
  | { ok: true }
  | { ok: false; reason: 'missing_secret' | 'missing_env' | 'mismatch' };

function readHeader(req: VercelRequest, name: string): string | null {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return typeof raw === 'string' ? raw : null;
}

export function verifyVapiSecret(req: VercelRequest): SecretCheck {
  const expected = process.env.VAPI_WEBHOOK_SECRET;
  if (!expected || expected.length === 0) {
    return { ok: false, reason: 'missing_env' };
  }

  const provided = readHeader(req, 'x-vapi-secret');
  if (!provided || provided.length === 0) {
    return { ok: false, reason: 'missing_secret' };
  }

  // Buffers must be equal length for timingSafeEqual — bail early if not.
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return { ok: false, reason: 'mismatch' };
  }

  return timingSafeEqual(expectedBuf, providedBuf)
    ? { ok: true }
    : { ok: false, reason: 'mismatch' };
}
