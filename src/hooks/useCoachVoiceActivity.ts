/**
 * useCoachVoiceActivity — B51: live amplitude for the coach's voice, same
 * output shape as useMicVoiceActivity (see useMicRingIntensity.ts) so
 * OrbControls can drive both halves of the orb off one consistent signal.
 *
 * Sources, in priority order (a higher-priority real signal always wins over
 * a lower one; nothing here overrides a genuine live reading):
 *
 *   1. Real playback — coachAudioBus taps whatever HTMLAudioElement is
 *      currently playing coach audio (Direct-LLM chunked TTS, beat-opener
 *      MP3/Cartesia clips) via a shared AnalyserNode. A REAL amplitude
 *      reading of the actual sound.
 *
 *   2. Real Vapi level — `assistantVolumeLevel` (see useRealtimeVoice.ts),
 *      Vapi's own `volume-level` SDK event. Also a REAL reading, just not
 *      via WebAudio (Vapi's audio is a Daily/WebRTC-owned element the app
 *      does not create; this SDK event is the vendor's own equivalent).
 *
 *   3. Synthesized fallback — only while `assistantSpeaking` is true but
 *      NEITHER of the above has reported anything yet (e.g. the brief moment
 *      before Vapi's first 'volume-level' tick lands). A smooth breathing
 *      envelope so the orb never sits dead during a real speaking window.
 *      Not a real waveform reading — callers that need to distinguish should
 *      check `source`.
 */
import { useEffect, useRef, useState } from 'react';
import { subscribeCoachAudioLevel } from '@/lib/audio/coachAudioBus';

export interface CoachVoiceActivity {
  /** 0..1 amplitude, bucketed to 0.05 steps (matches useMicVoiceActivity). */
  intensity: number;
  /** True while the coach is actually producing audio (real or fallback). */
  speaking: boolean;
  /** Where `intensity` came from. 'silent' when not speaking. */
  source: 'audio' | 'vapi' | 'fallback' | 'silent';
}

const BUCKET = 0.05;
const bucket = (v: number) => Math.round(v / BUCKET) * BUCKET;

/**
 * @param assistantSpeaking the voice session's isAssistantSpeaking flag —
 *   gates the synthesized fallback envelope.
 * @param vapiVolumeLevel real-time 0..1 from Vapi's 'volume-level' event
 *   (session.assistantVolumeLevel), when Vapi is the active engine.
 */
export function useCoachVoiceActivity(
  assistantSpeaking: boolean,
  vapiVolumeLevel = 0,
): CoachVoiceActivity {
  const [activity, setActivity] = useState<CoachVoiceActivity>({
    intensity: 0,
    speaking: false,
    source: 'silent',
  });
  const emittedRef = useRef<CoachVoiceActivity>(activity);
  const busActiveRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const setIfChanged = (next: CoachVoiceActivity) => {
    const prev = emittedRef.current;
    if (
      prev.intensity !== next.intensity ||
      prev.speaking !== next.speaking ||
      prev.source !== next.source
    ) {
      emittedRef.current = next;
      setActivity(next);
    }
  };

  // Priority 1: real playback via the shared audio-element bus, regardless of
  // assistantSpeaking (some paths don't flip that flag).
  useEffect(() => {
    const unsub = subscribeCoachAudioLevel((level) => {
      busActiveRef.current = level.active;
      if (!level.active) return;
      setIfChanged({ intensity: bucket(level.amp), speaking: true, source: 'audio' });
    });
    return unsub;
  }, []);

  // Priority 2: real Vapi volume-level, only when the bus has no active
  // element (a real WebAudio reading always wins over the SDK's own number).
  useEffect(() => {
    if (busActiveRef.current) return;
    if (vapiVolumeLevel > 0) {
      setIfChanged({ intensity: bucket(vapiVolumeLevel), speaking: true, source: 'vapi' });
    }
  }, [vapiVolumeLevel]);

  // Priority 3: synthesized fallback — only while assistantSpeaking is true
  // AND neither real source has reported anything (checked live, every tick,
  // so a real reading arriving mid-fallback takes over immediately).
  useEffect(() => {
    if (!assistantSpeaking) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (!busActiveRef.current && vapiVolumeLevel <= 0) {
        setIfChanged({ intensity: 0, speaking: false, source: 'silent' });
      }
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      if (busActiveRef.current || vapiVolumeLevel > 0) {
        // A real source is (or became) active — stop synthesizing, its own
        // effect owns emission now.
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const t = (now - start) / 1000;
      const v = 0.45 + 0.28 * Math.sin(t * 6.4) + 0.16 * Math.sin(t * 11.3 + 1.1);
      setIfChanged({
        intensity: bucket(Math.max(0.05, Math.min(1, v))),
        speaking: true,
        source: 'fallback',
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [assistantSpeaking, vapiVolumeLevel]);

  return activity;
}
