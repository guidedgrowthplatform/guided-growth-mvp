/**
 * Locked-opener-first resolution for the flow-engine surfaces (B48).
 *
 * The curated opener registry (onboardingOpeners.ts) is the LOCKED source for
 * a beat's first coach line: deterministic, reviewed copy that must render
 * verbatim (with {name} substituted) so the question never drifts. The flow
 * document's voice.openerText is authored/seeded copy plus, for some beats, a
 * hardcoded transform fallback (designerToFlow resolveOpener) -- neither may
 * win when a locked line exists for the beat's screenId.
 *
 * Resolution here is RUNTIME, not transform-time, on purpose: the profile
 * beat's locked line has two variants chosen by whether the user's name is
 * already known (known-name vs ask-name), which only the running session can
 * decide. The voice provider's instant-opener path already resolves through
 * getOnboardingOpenerForState; this module gives the rendered bubbles the
 * same rule so text and voice can never disagree.
 *
 * NO EM DASHES. Pure leaf module (no React).
 */
import { getOnboardingOpenerForState } from '@/components/onboarding/onboardingOpeners';
import type { FlowNode } from '../types';

/**
 * The opener text for a beat: the locked line when one exists for this
 * screenId (name-variant aware), otherwise the flow document's authored
 * opener. Returns the raw template ({name} not yet substituted); callers
 * apply applyName so the literal token never renders.
 */
export function resolveBeatOpenerText(
  node: Pick<FlowNode, 'screenId' | 'voice'>,
  nickname?: string | null,
): string | null {
  const locked = getOnboardingOpenerForState(node.screenId, nickname ?? null);
  return locked ?? node.voice.openerText;
}
