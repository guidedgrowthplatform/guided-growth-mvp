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
 * Per Yair's 2026-07-07 ruling, only the profile beat keeps a locked registry
 * line today (its two state-aware variants are functionally better than the
 * seed). Every other beat falls through to the flow document's seed/render
 * copy. resolveOnboardingOpener below is the screenId-only entry point for
 * callers that don't hold a FlowNode (the legacy chat-native path) so that
 * fallback always resolves the SAME seed text resolveBeatOpenerText would,
 * never a silent empty string.
 *
 * NO EM DASHES. Pure leaf module (no React).
 */
import { getOnboardingOpenerForState } from '@/components/onboarding/onboardingOpeners';
import type { FlowNode } from '../types';
import { loadPublishedFlow } from '../useFlow';

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

function buildOpenerTextByScreen(): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const node of loadPublishedFlow().nodes) {
    map.set(node.screenId, node.voice.openerText);
  }
  return map;
}

const OPENER_TEXT_BY_SCREEN = buildOpenerTextByScreen();

/**
 * Same resolution as resolveBeatOpenerText, for callers that only have a
 * screenId (no FlowNode in hand): the legacy chat-native opener paths in
 * useOnboardingChat.ts and OnboardingVoiceProvider.tsx. Looks up the flow
 * document's seed opener for the fallback instead of returning '' when no
 * locked line exists, so those beats never render/speak a silent opener.
 */
export function resolveOnboardingOpener(screenId: string, nickname?: string | null): string {
  const locked = getOnboardingOpenerForState(screenId, nickname ?? null);
  if (locked) return locked;
  return OPENER_TEXT_BY_SCREEN.get(screenId) ?? '';
}
