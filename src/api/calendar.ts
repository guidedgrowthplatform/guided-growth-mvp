import { ApiError, apiGet, apiPost } from './client';

// Native connect result read by Settings after the deep-link return (web uses
// the ?calendar= query param instead).
export type CalendarResult = 'connected' | 'error';
const RESULT_FLAG = 'gg_calendar_result';
const RESULT_FLAG_TTL_MS = 5 * 60_000;

export function markCalendarResult(result: CalendarResult): void {
  try {
    sessionStorage.setItem(RESULT_FLAG, `${result}:${Date.now()}`);
  } catch {
    // sessionStorage unavailable — skip the toast
  }
}

export function consumeCalendarResult(): CalendarResult | null {
  try {
    const raw = sessionStorage.getItem(RESULT_FLAG);
    if (!raw) return null;
    sessionStorage.removeItem(RESULT_FLAG);
    const sep = raw.lastIndexOf(':');
    const result = raw.slice(0, sep);
    if (Date.now() - Number(raw.slice(sep + 1)) > RESULT_FLAG_TTL_MS) return null;
    return result === 'connected' || result === 'error' ? result : null;
  } catch {
    return null;
  }
}

// Where the web OAuth boot-capture (main.tsx) should land instead of the
// default return path — set by surfaces the app gate would bounce (QA page).
const RETURN_TO_FLAG = 'gg_calendar_return_to';

export function markCalendarReturnTo(path: string): void {
  try {
    sessionStorage.setItem(RETURN_TO_FLAG, path);
  } catch {
    // sessionStorage unavailable — return lands on /settings as before
  }
}

export function clearCalendarReturnTo(): void {
  try {
    sessionStorage.removeItem(RETURN_TO_FLAG);
  } catch {
    // ignore
  }
}

export function consumeCalendarReturnTo(): string | null {
  try {
    const path = sessionStorage.getItem(RETURN_TO_FLAG);
    if (path) sessionStorage.removeItem(RETURN_TO_FLAG);
    // internal absolute paths only — no protocol-relative / external targets
    return path && path.startsWith('/') && !path.startsWith('//') ? path : null;
  } catch {
    return null;
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

export interface StartCalendarOAuthBody {
  platform: 'web' | 'native';
  scheme?: string;
}

// Token captured server-side on /oauth-callback — never on the client.
export function startCalendarOAuth(body: StartCalendarOAuthBody): Promise<{ url: string }> {
  return apiPost('/api/calendar/oauth-start', body);
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
