/**
 * coachAudioBus — B51: a shared registry of "whichever HTMLAudioElement is
 * currently playing the coach's voice", so the orb can pulse to the REAL
 * playback amplitude no matter which of the several coach-audio paths is
 * speaking right now.
 *
 * Why a bus and not one hook per caller: coach audio comes out of several
 * independent playback paths that each own their own HTMLAudioElement
 * (tts-service's chunked Direct-LLM queue, useBeatOpenerMp3's pooled opener
 * clips, useBeatOpenerCartesia's speakOpener one-shot, useVoicePlayer's
 * manifest assets). Exactly one of them is ever actually playing coach audio
 * at a time (beatAudioOwner already enforces that for the beat-opener paths),
 * so instead of instrumenting each with its own AnalyserNode, every path just
 * calls `registerCoachAudioElement(el)` right before it plays and
 * `unregisterCoachAudioElement(el)` when it stops/ends. The bus taps
 * whichever element is currently registered.
 *
 * WebAudio notes (read before touching this file):
 *   - Calling `createMediaElementSource(el)` on an element PERMANENTLY reroutes
 *     that element's audio graph through WebAudio — after that call the
 *     element's audio no longer reaches the speakers unless the source node
 *     is connected forward to `ctx.destination`. This module always connects
 *     source -> analyser -> destination, so sound still plays normally; the
 *     analyser is a passive tap, not a replacement path.
 *   - `createMediaElementSource` throws if called twice on the SAME element
 *     (the browser only lets an element be wrapped once, ever, for its
 *     lifetime). Pooled elements (openerPreloadPool, the beat-opener MP3 path)
 *     are reused across many activations, so a WeakMap caches the created
 *     source node per element and reuses it on re-registration instead of
 *     re-wrapping.
 *   - One shared AudioContext for the whole bus (created lazily, on first
 *     registration, inside whatever call stack that is — playback itself
 *     only ever starts from a user gesture or a beat activation that already
 *     followed one, so this does not add a new autoplay-policy risk).
 */

export interface CoachAudioLevel {
  /** 0..1 smoothed RMS-ish amplitude of whatever coach audio is playing now. */
  amp: number;
  /** True while a registered element is actually producing audible playback. */
  active: boolean;
}

type Listener = (level: CoachAudioLevel) => void;

let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let timeDomainBuf: Float32Array<ArrayBuffer> | null = null;
const sourceCache = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();

let currentEl: HTMLAudioElement | null = null;

let rafId: number | null = null;
const listeners = new Set<Listener>();
const smoothedRef = { value: 0 };
const SMOOTH_ALPHA = 0.35;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtx) return audioCtx;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0;
  timeDomainBuf = new Float32Array(analyser.fftSize);
  return audioCtx;
}

function computeRms(): number {
  if (!analyser || !timeDomainBuf) return 0;
  analyser.getFloatTimeDomainData(timeDomainBuf);
  let sum = 0;
  for (let i = 0; i < timeDomainBuf.length; i++) {
    const v = timeDomainBuf[i];
    sum += v * v;
  }
  return Math.sqrt(sum / timeDomainBuf.length);
}

// Speech-ish RMS range for synthesized TTS/MP3 playback at typical volume
// (0.85, see tts-service/speakOpener). Calibrated empirically (see QA amp
// samples in the B51 MR description), not the mic RMS scale in
// audioMetricsStore (different signal chain, different floor/ceiling).
const AMP_FLOOR = 0.01;
const AMP_CEIL = 0.35;

function rmsToAmp(rms: number): number {
  const t = (rms - AMP_FLOOR) / (AMP_CEIL - AMP_FLOOR);
  return Math.max(0, Math.min(1, t));
}

function emit(level: CoachAudioLevel): void {
  listeners.forEach((fn) => fn(level));
}

function stopLoop(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function startLoop(): void {
  if (rafId !== null) return;
  const tick = () => {
    const el = currentEl;
    const playing = !!el && !el.paused && !el.ended && el.currentTime > 0;
    if (!playing) {
      smoothedRef.value = 0;
      emit({ amp: 0, active: false });
      rafId = requestAnimationFrame(tick);
      return;
    }
    const rms = computeRms();
    const target = rmsToAmp(rms);
    smoothedRef.value = smoothedRef.value * (1 - SMOOTH_ALPHA) + target * SMOOTH_ALPHA;
    emit({ amp: smoothedRef.value, active: true });
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function connectElement(el: HTMLAudioElement): MediaElementAudioSourceNode | null {
  const ctx = getCtx();
  if (!ctx || !analyser) return null;
  const cached = sourceCache.get(el);
  if (cached) return cached;
  let node: MediaElementAudioSourceNode;
  try {
    node = ctx.createMediaElementSource(el);
  } catch (err) {
    // Already wrapped by something else, or an unsupported element state.
    // Non-fatal: the orb just won't react for this element, playback is
    // unaffected either way (we never got the chance to touch its graph).
    console.warn('[coachAudioBus] createMediaElementSource failed', err);
    return null;
  }
  node.connect(analyser);
  // Always reconnect to destination — the AnalyserNode is a passive tap, not
  // a replacement output. Without this the element would go silent the
  // moment it is wrapped, permanently, for the lifetime of the page.
  node.connect(ctx.destination);
  sourceCache.set(el, node);
  return node;
}

/**
 * Register the element that is about to (or already does) play coach audio.
 * Safe to call every time a path starts a new clip on a pooled/reused
 * element — reconnecting is a no-op when it's already the current element.
 */
export function registerCoachAudioElement(el: HTMLAudioElement): void {
  if (typeof window === 'undefined') return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  if (currentEl === el) {
    startLoop();
    return;
  }
  currentEl = el;
  connectElement(el);
  startLoop();
}

/**
 * Unregister an element (playback ended/stopped). No-op unless `el` is the
 * currently registered element, so a stale release from a superseded clip
 * can't evict whatever started playing after it.
 */
export function unregisterCoachAudioElement(el: HTMLAudioElement): void {
  if (currentEl !== el) return;
  currentEl = null;
  smoothedRef.value = 0;
  emit({ amp: 0, active: false });
}

export function subscribeCoachAudioLevel(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) stopLoop();
  };
}

/** Test/debug only: current registered element, if any. */
export function currentCoachAudioElement(): HTMLAudioElement | null {
  return currentEl;
}

/** Test-only: reset all module state between tests. */
export function resetCoachAudioBusForTests(): void {
  stopLoop();
  currentEl = null;
  smoothedRef.value = 0;
  listeners.clear();
  // Deliberately do NOT close/null audioCtx/analyser/sourceCache: a real
  // AudioContext + MediaElementSource wrapping is permanent for an element's
  // lifetime by spec, and tests mock AudioContext/Audio entirely so there is
  // nothing real to tear down.
}
