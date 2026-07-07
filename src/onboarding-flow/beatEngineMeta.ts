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
import type { BeatRuntimeMeta, FlowNode } from './types';
import { loadPublishedFlow } from './useFlow';

function buildMetaMap(): Map<string, BeatRuntimeMeta> {
  const map = new Map<string, BeatRuntimeMeta>();
  for (const node of loadPublishedFlow().nodes) {
    if (node.meta) map.set(node.screenId, node.meta);
  }
  return map;
}

const META_BY_SCREEN = buildMetaMap();

// Does BeatView independently play THIS beat's opener as real audio (an
// authored MP3 clip, a live Cartesia line, or a narration script)? Mirrors
// BeatView's own hasOpenerAudio / hasNarration gates exactly: narration (and
// componentOwned, which owns its entire sequence and never reaches
// Direct-LLM — screenId isn't onboarding-prefixed) live on the FlowNode
// itself, not in BeatRuntimeMeta, so this needs the raw node, not just meta.
function nodeOwnsOpenerAudio(node: FlowNode): boolean {
  if (node.componentOwned) return false;
  if ((node.narration?.length ?? 0) > 0) return true;
  const engine = node.meta?.voiceOut?.engine;
  return engine === 'mp3' || engine === 'cartesia';
}

function buildOpenerAudioSet(): Set<string> {
  const set = new Set<string>();
  for (const node of loadPublishedFlow().nodes) {
    if (nodeOwnsOpenerAudio(node)) set.add(node.screenId);
  }
  return set;
}

const OPENER_AUDIO_SCREENS = buildOpenerAudioSet();

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

/**
 * Does BeatView (or the narration driver) already play this beat's opener as
 * real audio (an authored MP3 clip, a live Cartesia line, or a narration
 * script)? When true, Direct-LLM (useOnboardingChat) must not ALSO generate
 * and speak a second opener for the same beat id — that redundant call was
 * the beat-audio double-arm's actual source (B58/B40): beatAudioOwner's
 * claim registry only logs the collision and backs the second claimant off,
 * it never stopped the call from firing in the first place. No legacy-set
 * fallback: narration and voiceOut.engine are meta/node-only fields with no
 * pre-metadata equivalent, unlike isVapiCapableBeat/isIdleCaptureBeat above.
 */
export function beatOwnsOpenerAudio(screenId: string | null | undefined): boolean {
  if (!screenId) return false;
  return OPENER_AUDIO_SCREENS.has(screenId);
}
