import { ApiError, apiGet, apiPost } from './client';

export const CALENDAR_SCOPES =
  'https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/calendar.events';

// Fallback signal for the OAuth callback in case the ?intent=calendar query param
// doesn't survive Supabase's redirect round-trip. Set before consent, read on return.
const CONNECT_FLAG = 'gg_calendar_connect_pending';
const CONNECT_FLAG_TTL_MS = 5 * 60_000;

export function markCalendarConnectPending(): void {
  try {
    sessionStorage.setItem(CONNECT_FLAG, String(Date.now()));
  } catch {
    // sessionStorage unavailable — rely on the query param
  }
}

// Consumes (always clears) the flag. Valid only within the TTL so an abandoned
// connect attempt can't later mis-route a normal login.
export function consumeCalendarConnectPending(): boolean {
  try {
    const raw = sessionStorage.getItem(CONNECT_FLAG);
    if (!raw) return false;
    sessionStorage.removeItem(CONNECT_FLAG);
    return Date.now() - Number(raw) < CONNECT_FLAG_TTL_MS;
  } catch {
    return false;
  }
}

// One-shot "Calendar connected" confirmation, read by Settings after the redirect.
const CONNECTED_FLAG = 'gg_calendar_just_connected';

export function markCalendarJustConnected(): void {
  try {
    sessionStorage.setItem(CONNECTED_FLAG, String(Date.now()));
  } catch {
    // sessionStorage unavailable — skip the toast
  }
}

export function consumeCalendarJustConnected(): boolean {
  try {
    const raw = sessionStorage.getItem(CONNECTED_FLAG);
    if (!raw) return false;
    sessionStorage.removeItem(CONNECTED_FLAG);
    return Date.now() - Number(raw) < CONNECT_FLAG_TTL_MS;
  } catch {
    return false;
  }
}

// A calendar ApiError meaning the Google refresh token is dead → reconnect needed.
export function isReauthError(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 401 &&
    (err.body as { error?: string } | undefined)?.error === 'reauth_required'
  );
}

export interface CalendarStatus {
  connected: boolean;
  target: 'own' | 'gg';
  enabled: boolean;
  needsReauth: boolean;
}

export function connectCalendar(refreshToken: string): Promise<{ ok: boolean }> {
  return apiPost('/api/calendar/connect', { refreshToken, scopes: CALENDAR_SCOPES });
}

export function getCalendarStatus(): Promise<CalendarStatus> {
  return apiGet('/api/calendar/status');
}

export function disconnectCalendar(): Promise<{ ok: boolean }> {
  return apiPost('/api/calendar/disconnect', {});
}

export function setCalendarTarget(target: 'own' | 'gg'): Promise<{ ok: boolean }> {
  return apiPost('/api/calendar/target', { target });
}

export function setCalendarEnabled(enabled: boolean): Promise<{ ok: boolean }> {
  return apiPost('/api/calendar/toggle', { enabled });
}

export function syncCalendar(): Promise<{
  ok: boolean;
  written?: number;
  deleted?: number;
  skipped?: boolean;
}> {
  return apiPost('/api/calendar/sync', {});
}
