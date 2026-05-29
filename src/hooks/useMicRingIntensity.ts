import { useEffect, useRef, useState } from 'react';
import { useAudioMetricsStore } from '@/stores/audioMetricsStore';

// audioMetricsStore RMS scale: speech floor → close-talk peak.
const SPEECH_FLOOR = 0.005;
const SPEECH_CEIL = 0.05;
const EMA_ALPHA = 0.3;
// Bucket → re-render only on 0.05 steps, not every audio frame.
const BUCKET = 0.05;

export function rmsToIntensity(rms: number): number {
  const t = (rms - SPEECH_FLOOR) / (SPEECH_CEIL - SPEECH_FLOOR);
  return Math.max(0, Math.min(1, t));
}

export function useMicRingIntensity(active: boolean): number {
  const [intensity, setIntensity] = useState(0);
  const smoothedRef = useRef(0);
  const emittedRef = useRef(0);

  useEffect(() => {
    if (!active) {
      smoothedRef.current = 0;
      emittedRef.current = 0;
      setIntensity(0);
      return;
    }
    let raf = 0;
    const tick = () => {
      const rms = useAudioMetricsStore.getState().currentRms;
      smoothedRef.current = smoothedRef.current * (1 - EMA_ALPHA) + rmsToIntensity(rms) * EMA_ALPHA;
      const bucket = Math.round(smoothedRef.current / BUCKET) * BUCKET;
      if (bucket !== emittedRef.current) {
        emittedRef.current = bucket;
        setIntensity(bucket);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return intensity;
}
