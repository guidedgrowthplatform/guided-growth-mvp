// Single source of truth for the onboarding event console log. All three voice
// paths (Vapi / async / direct-LLM) route through logDebugEvent so the console
// reads as one uniform timeline.

export type DebugSource = 'vapi' | 'llm' | 'session';

export interface DebugEntry {
  source: DebugSource;
  label: string;
  ok?: boolean | null; // undefined → neutral (session event); true/false → tool outcome
  code?: string | null;
  detail?: Record<string, unknown>;
}

// On in DEV, or in any build once localStorage.gg_onboarding_debug (or the
// legacy gg_vapi_debug) is truthy — lets the client watch the live deployment
// without a rebuild (set it in devtools, reload).
export function debugEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return !!(localStorage.getItem('gg_onboarding_debug') || localStorage.getItem('gg_vapi_debug'));
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
