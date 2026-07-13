import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CALENDAR_SCOPES } from '@gg/shared/constants';

// oauth.ts imports `../db.js` — mock the pool so these unit tests need no DB.
vi.mock('../../db.js', () => ({ default: { query: vi.fn() } }));

import pool from '../../db.js';
const {
  createOAuthNonce,
  consumeOAuthNonce,
  buildConsentUrl,
  hasRequiredScopes,
  isValidScheme,
  calendarRedirectUri,
} = await import('../oauth.js');

const query = pool.query as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  query.mockReset();
  vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id');
  vi.stubEnv('CALENDAR_OAUTH_REDIRECT_ORIGIN', 'https://app.test');
});
afterEach(() => vi.unstubAllEnvs());

describe('createOAuthNonce', () => {
  it('cleans stale rows then inserts a nonce bound to the user + target', async () => {
    query.mockResolvedValue({ rows: [] });
    const nonce = await createOAuthNonce('anon-1', 'native', 'guidedgrowth');
    expect(nonce).toMatch(/^[a-f0-9]{64}$/);
    expect(query.mock.calls[0][0]).toMatch(/DELETE FROM calendar_oauth_state WHERE created_at/);
    const insert = query.mock.calls[1];
    expect(insert[0]).toMatch(/INSERT INTO calendar_oauth_state/);
    expect(insert[1]).toEqual([nonce, 'anon-1', 'native', 'guidedgrowth']);
  });
});

describe('consumeOAuthNonce', () => {
  it('maps the single-use DELETE RETURNING row', async () => {
    query.mockResolvedValueOnce({ rows: [{ anon_id: 'a', platform: 'web', scheme: null }] });
    await expect(consumeOAuthNonce('n')).resolves.toEqual({
      anonId: 'a',
      platform: 'web',
      scheme: null,
    });
    expect(query.mock.calls[0][0]).toMatch(/DELETE FROM calendar_oauth_state[\s\S]*RETURNING/);
  });

  it('returns null when no row (missing / expired / already used)', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(consumeOAuthNonce('n')).resolves.toBeNull();
  });

  it('returns null for an empty nonce without touching the db', async () => {
    await expect(consumeOAuthNonce('')).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });
});

describe('buildConsentUrl', () => {
  it('carries state, offline access, prompt=consent, scopes, and the redirect_uri', () => {
    const url = buildConsentUrl('NONCE');
    expect(url).toContain('state=NONCE');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
    expect(url).toContain(encodeURIComponent('calendar.events'));
    expect(url).toContain(encodeURIComponent('https://app.test/api/calendar/oauth-callback'));
  });
});

describe('hasRequiredScopes', () => {
  it('true only when every requested scope was granted', () => {
    expect(hasRequiredScopes(CALENDAR_SCOPES)).toBe(true);
    expect(hasRequiredScopes('https://www.googleapis.com/auth/calendar.events')).toBe(false);
    expect(hasRequiredScopes(undefined)).toBe(false);
  });
});

describe('isValidScheme', () => {
  it('accepts only the known native schemes by exact equality', () => {
    expect(isValidScheme('guidedgrowth')).toBe(true);
    expect(isValidScheme('guidedgrowthqa')).toBe(true);
    expect(isValidScheme('guidedgrowth.evil')).toBe(false);
    expect(isValidScheme('javascript')).toBe(false);
    expect(isValidScheme(null)).toBe(false);
  });
});

describe('calendarRedirectUri', () => {
  it('derives from CALENDAR_OAUTH_REDIRECT_ORIGIN', () => {
    expect(calendarRedirectUri()).toBe('https://app.test/api/calendar/oauth-callback');
  });
});
