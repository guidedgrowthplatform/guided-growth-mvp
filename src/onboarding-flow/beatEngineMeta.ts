/**
 * Engine-per-beat accessor (metadata-driven).
 *
 * The re-exported flow carries a `meta` block on every node (see
 * transform/designerToFlow.ts resolveMeta + BeatRuntimeMeta in types.ts). This
 * module is the ONE place that answers "what engine runs this beat" from that
 * meta, so the provider/orchestrator no longer key off the scattered sets
 * (CHAT_VAPI_BEAT_SCREENS, LOCAL_CAPTURE_BEATS). Those sets are imported here
 * ONLY as a fallback for any screen the generated meta does not cover, so the
 * classification is identical when meta is present and never regresses when it
 * is absent.
 *
 * Source: the LIVE FlowDocument from useFlow's loader (same validation + TS
 * fallback as the engine), not an independent JSON re-import. If a future flow
 * is fetched from Supabase, replace buildMetaMap with a fetch; callers are
 * unchanged.
 */
import { CHAT_VAPI_BEAT_SCREENS, LOCAL_CAPTURE_BEATS } from '@/lib/onboarding/onboardingStepBeats';
import type { BeatRuntimeMeta } from './types';
import { loadPublishedFlow } from './useFlow';

function buildMetaMap(): Map<string, BeatRuntimeMeta> {
  const map = new Map<string, BeatRuntimeMeta>();
  for (const node of loadPublishedFlow().nodes) {
    if (node.meta) map.set(node.screenId, node.meta);
  }
  return map;
}

const META_BY_SCREEN = buildMetaMap();

/** The full runtime meta for a beat, or undefined if the flow does not cover it. */
export function getBeatMeta(screenId: string | null | undefined): BeatRuntimeMeta | undefined {
  if (!screenId) return undefined;
  return META_BY_SCREEN.get(screenId);
}

/** Does Vapi own this beat's conversation? Meta-first, legacy set as fallback. */
export function isVapiCapableBeat(screenId: string | null | undefined): boolean {
  if (!screenId) return false;
  const meta = META_BY_SCREEN.get(screenId);
  return meta ? meta.fill?.brain === 'vapi' : CHAT_VAPI_BEAT_SCREENS.has(screenId);
}

/** Adapter-owned capture beat (engine idle). Meta-first, legacy set as fallback. */
export function isIdleCaptureBeat(screenId: string | null | undefined): boolean {
  if (!screenId) return false;
  const meta = META_BY_SCREEN.get(screenId);
  return meta ? meta.fill?.brain === 'none' : LOCAL_CAPTURE_BEATS.has(screenId);
}
