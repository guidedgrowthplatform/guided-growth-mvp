import { getBeatAllowedTools } from './beatContexts.js';
import { ONBOARDING_TOOLS, type OnboardingToolDefinition } from './schemas.js';

export function isOnboardingScreen(screenId: string | null | undefined): boolean {
  return typeof screenId === 'string' && screenId.startsWith('ONBOARD-');
}

/**
 * Tools the coach may call on a given onboarding beat.
 *
 * Per-beat gating (the fix for the wrong-tool-on-wrong-beat bug): each beat in
 * beatContexts declares its `allowedTools`, and only those are exposed to the
 * model. The route handler enforces it (a tool outside this set returns
 * `unknown_tool`). Two fallbacks keep things safe:
 *   - beat NOT in beatContexts (allowed === undefined): expose all tools (legacy
 *     screens that have not been given an explicit allow-list yet).
 *   - beat with an empty allow-list (e.g. the silent auth beat): expose none.
 */
export function getOnboardingTools(
  screenId: string | null | undefined,
): readonly OnboardingToolDefinition[] | undefined {
  if (!isOnboardingScreen(screenId)) return undefined;
  const allowed = getBeatAllowedTools(screenId as string);
  if (allowed === undefined) return ONBOARDING_TOOLS;
  const allowedSet = new Set<string>(allowed);
  return ONBOARDING_TOOLS.filter((t) => allowedSet.has(t.name));
}
