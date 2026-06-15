// Single sink for the onboarding console log — all paths route through logDebugEvent.

export type DebugSource = 'vapi' | 'llm' | 'session';

export interface DebugEntry {
  source: DebugSource;
  label: string;
  ok?: boolean | null; // undefined → neutral (session event); true/false → tool outcome
  code?: string | null;
  detail?: Record<string, unknown>;
}

// On in DEV, or any build where localStorage.gg_debug is set (watch live deploy, no rebuild).
export function debugEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return !!localStorage.getItem('gg_debug');
  } catch {
    return false;
  }
}

export function isOnboardingScreen(screenId: string | null | undefined): boolean {
  return !!screenId && screenId.startsWith('ONBOARD');
}

const BADGE: Record<DebugSource, string> = {
  vapi: 'onb·vapi',
  llm: 'onb·llm',
  session: 'onb·session',
};

export function logDebugEvent({ source, label, ok, code, detail }: DebugEntry): void {
  if (!debugEnabled()) return;
  const icon = ok === undefined || ok === null ? '▸' : ok ? '✅' : '❌';
  const suffix = ok === false && code ? ` — ${code}` : '';

  console.groupCollapsed(`[${BADGE[source]}] ${icon} ${label}${suffix}`);
  if (detail && Object.keys(detail).length > 0) console.log(detail);
  console.log('at:', new Date().toISOString());
  console.groupEnd();
}
