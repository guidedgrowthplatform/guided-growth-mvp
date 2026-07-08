// Single sink for the onboarding console log — all paths route through logDebugEvent.

type DebugSource = 'vapi' | 'llm' | 'session';

export interface DebugEntry {
  source: DebugSource;
  label: string;
  ok?: boolean | null; // undefined → neutral (session event); true/false → tool outcome
  code?: string | null;
  detail?: Record<string, unknown>;
}

// On in DEV, or any build where localStorage.gg_debug is set (watch live deploy, no rebuild).
function debugEnabled(): boolean {
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

// Reads the real server error code off a failed tool_result payload's
// `error` field (see the ToolResult union in api/_lib/llm/tools.ts: 'unknown_tool'
// | 'invalid_args' | 'not_found' | 'handler_error', plus onboarding-specific
// codes like 'habit_name_ungrounded' surfaced via the same field or message).
// Falls back to a generic label only when the payload carries no usable code,
// so the console top line shows what actually failed instead of always
// reading the same generic suffix.
export function toolResultErrorCode(result: unknown): string {
  if (result && typeof result === 'object' && 'error' in result) {
    const code = (result as { error?: unknown }).error;
    if (typeof code === 'string' && code.trim() !== '') return code;
  }
  return 'tool_failed';
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
