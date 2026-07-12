import { beforeEach, describe, expect, it, vi } from 'vitest';

// getValidAccessToken (via the block) reads the pool — mock it.
vi.mock('../../db.js', () => ({ default: { query: vi.fn() } }));

import pool from '../../db.js';
const { buildUpcomingEventsBlock } = await import('../buildSystemPrompt.js');
const { isCheckinScreen, isReadOnlyCheckinScreen } = await import('../checkin/registry.js');

const query = pool.query as unknown as ReturnType<typeof vi.fn>;

const validTokenRow = {
  access_token: 'valid-token',
  refresh_token: 'r',
  token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  enabled: true,
};

function fetchOnce(res: { ok: boolean; status: number; json?: unknown; text?: string }) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: res.ok,
    status: res.status,
    json: async () => res.json,
    text: async () => res.text ?? '',
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  query.mockReset();
  global.fetch = vi.fn();
});

describe('buildUpcomingEventsBlock', () => {
  it('returns empty and hits nothing when timezone is missing', async () => {
    expect(await buildUpcomingEventsBlock('anon-notz', undefined)).toBe('');
    expect(query).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns empty (no throw) when the connection is disabled', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...validTokenRow, enabled: false }] });
    expect(await buildUpcomingEventsBlock('anon-disabled', 'UTC')).toBe('');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns empty when not connected', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await buildUpcomingEventsBlock('anon-none', 'UTC')).toBe('');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns empty when there are no events today', async () => {
    query.mockResolvedValueOnce({ rows: [validTokenRow] });
    fetchOnce({ ok: true, status: 200, json: { items: [] } });
    expect(await buildUpcomingEventsBlock('anon-empty', 'UTC')).toBe('');
  });

  it('formats a block from the primary calendar events', async () => {
    query.mockResolvedValueOnce({ rows: [validTokenRow] });
    fetchOnce({
      ok: true,
      status: 200,
      json: { items: [{ summary: 'Standup', start: { dateTime: '2026-07-11T09:30:00Z' } }] },
    });
    const block = await buildUpcomingEventsBlock('anon-ok', 'UTC');
    expect(block).toContain('## Upcoming Events Today');
    expect(block).toContain('- 09:30 Standup');
  });

  it('returns empty (never throws) on a Google outage', async () => {
    query.mockResolvedValueOnce({ rows: [validTokenRow] });
    fetchOnce({ ok: false, status: 503, text: 'unavailable' });
    expect(await buildUpcomingEventsBlock('anon-outage', 'UTC')).toBe('');
  });
});

// The block is only computed when this gate is true (buildSystemPrompt.ts).
// It must NEVER fire on onboarding — the onboarding path stores text unscrubbed.
describe('read-for-context gating contract', () => {
  const gated = (s: string) => isCheckinScreen(s) || isReadOnlyCheckinScreen(s);

  it('excludes onboarding and unrelated screens', () => {
    expect(gated('ONBOARD-01--FORM')).toBe(false);
    expect(gated('SPLASH')).toBe(false);
    expect(gated('SETTINGS')).toBe(false);
  });

  it('includes the check-in / home surface', () => {
    expect(gated('ECHECK-01')).toBe(true);
    expect(gated('MCHECK-01')).toBe(true);
    expect(gated('HOME-CHECKIN')).toBe(true);
  });
});
