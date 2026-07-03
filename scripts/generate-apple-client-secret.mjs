#!/usr/bin/env node
/**
 * Generates the Apple client secret JWT for Supabase's Apple OAuth provider
 * (web "Continue with Apple"). Native iOS signInWithIdToken does NOT need it.
 *
 * Usage:
 *   APPLE_TEAM_ID=XXXXXXXXXX APPLE_KEY_ID=YYYYYYYYYY \
 *   APPLE_SERVICES_ID=app.guidedgrowth.mvp.signin \
 *   node scripts/generate-apple-client-secret.mjs path/to/AuthKey_YYYYYYYYYY.p8
 *
 * Paste the output into Supabase → Auth → Providers → Apple → Secret Key
 * (or the Management API's external_apple_secret).
 *
 * ROTATION: Apple caps validity at 6 months. When it expires, web Apple
 * sign-in dies silently (Supabase returns invalid_client) — re-run this
 * script and update Supabase before the printed expiry date.
 */

import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const MAX_EXPIRES_IN = 15777000; // Apple's 6-month hard cap (seconds)
const EXPIRES_IN = MAX_EXPIRES_IN - 86400; // 1-day safety margin

const required = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
};

const teamId = required('APPLE_TEAM_ID');
const keyId = required('APPLE_KEY_ID');
const servicesId = required('APPLE_SERVICES_ID');
const p8Path = process.argv[2] ?? required('APPLE_P8_PATH');

const b64url = (input) => Buffer.from(input).toString('base64url');

const now = Math.floor(Date.now() / 1000);
const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
const payload = b64url(
  JSON.stringify({
    iss: teamId,
    iat: now,
    exp: now + EXPIRES_IN,
    aud: 'https://appleid.apple.com',
    sub: servicesId,
  }),
);
const signingInput = `${header}.${payload}`;
const signature = sign('sha256', Buffer.from(signingInput), {
  key: createPrivateKey(readFileSync(p8Path, 'utf-8')),
  // JOSE requires raw r||s signatures — Node's default DER encoding is invalid JWS
  dsaEncoding: 'ieee-p1363',
});

console.log(`${signingInput}.${b64url(signature)}`);
console.error(`# expires: ${new Date((now + EXPIRES_IN) * 1000).toISOString()} — rotate before then`);
