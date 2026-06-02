import { useEffect, useRef, useState } from 'react';
import { useAudioMetricsStore } from '@/stores/audioMetricsStore';

// audioMetricsStore RMS scale: speech floor → close-talk peak.
const SPEECH_FLOOR = 0.005;
const SPEECH_CEIL = 0.05;
const EMA_ALPHA = 0.3;
// Bucket → re-render only on 0.05 steps, not every audio frame.
const BUCKET = 0.05;

// Speech gate on smoothed intensity (0..1). Hysteresis + release hold so brief
// inter-word pauses don't drop the "speaking" ripple back to the ready state.
const SPEECH_OPEN = 0.15;
const SPEECH_CLOSE = 0.06;
const SPEECH_RELEASE_MS = 600;

export function rmsToIntensity(rms: number): number {
  const t = (rms - SPEECH_FLOOR) / (SPEECH_CEIL - SPEECH_FLOOR);
  return Math.max(0, Math.min(1, t));
}

export interface SpeechGate {
  speaking: boolean;
  // Monotonic timestamp speech first dropped below CLOSE; 0 = not below.
  belowSince: number;
}

// Pure hysteresis step. Open at SPEECH_OPEN, stay open until smoothed level sits
// below SPEECH_CLOSE for SPEECH_RELEASE_MS (rides out inter-word pauses).
export function stepSpeechGate(prev: SpeechGate, smoothed: number, now: number): SpeechGate {
  if (!prev.speaking) {
    return { speaking: smoothed >= SPEECH_OPEN, belowSince: 0 };
  }
  if (smoothed >= SPEECH_CLOSE) {
    return { speaking: true, belowSince: 0 };
  }
  const belowSince = prev.belowSince === 0 ? now : prev.belowSince;
  if (now - belowSince >= SPEECH_RELEASE_MS) {
    return { speaking: false, belowSince: 0 };
  }
  return { speaking: true, belowSince };
}

export interface MicVoiceActivity {
  /** 0..1 ring-pulse amplitude, bucketed to 0.05 steps. */
  intensity: number;
  /** True only while the user is actually talking (not just mic-open). */
  speaking: boolean;
}

// Live mic signal for the orb: amplitude for the ripple + a hysteretic
// speaking flag that separates "mic open, ready" from "user is talking".
export function useMicVoiceActivity(active: boolean): MicVoiceActivity {
  const [activity, setActivity] = useState<MicVoiceActivity>({ intensity: 0, speaking: false });
  const smoothedRef = useRef(0);
  const gateRef = useRef<SpeechGate>({ speaking: false, belowSince: 0 });
  const emittedIntensityRef = useRef(0);

  useEffect(() => {
    if (!active) {
      smoothedRef.current = 0;
      gateRef.current = { speaking: false, belowSince: 0 };
      emittedIntensityRef.current = 0;
      setActivity({ intensity: 0, speaking: false });
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      const rms = useAudioMetricsStore.getState().currentRms;
      smoothedRef.current = smoothedRef.current * (1 - EMA_ALPHA) + rmsToIntensity(rms) * EMA_ALPHA;
      const s = smoothedRef.current;

      const prevSpeaking = gateRef.current.speaking;
      gateRef.current = stepSpeechGate(gateRef.current, s, now);
      const speaking = gateRef.current.speaking;

      const bucket = Math.round(s / BUCKET) * BUCKET;
      if (bucket !== emittedIntensityRef.current || speaking !== prevSpeaking) {
        emittedIntensityRef.current = bucket;
        setActivity({ intensity: bucket, speaking });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return activity;
}
