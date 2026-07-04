/**
 * useBeatOpenerCartesia — speaks a beat opener via live Cartesia TTS when the
 * beat becomes active. The engine-flow counterpart of useBeatOpenerMp3 for
 * beats whose voiceOut.engine is 'cartesia' (variable lines that cannot be a
 * baked MP3 — today only ONBOARD-01--FORM, which greets by name).
 *
 * Until this hook, engine==='cartesia' beats had NO player at all in the flow
 * renderer: speakOpener() only ran on the env-gated Vapi instant-opener path,
 * so the karaoke captions ran their fixed-cadence timer over silence (B3).
 *
 * Same state shape as useBeatOpenerMp3 so BeatView can treat both uniformly.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { speakOpener, type SpeakOpenerHandle } from '@/lib/voice/speakOpener';
import { isQaMuted, subscribe as subscribeQaSound } from '@/onboarding-flow/qaSound';
import type { BeatOpenerMp3State } from './useBeatOpenerMp3';

// ~310ms/word spoken-cadence estimate, used only when the audio element can't
// report a finite duration (Chrome blob-MP3 Infinity bug) — mirrors the
// instant-opener path in OnboardingVoiceProvider.
const MS_PER_WORD_ESTIMATE = 310;
const MIN_ESTIMATE_MS = 1200;

export function useBeatOpenerCartesia(text: string | null, active: boolean): BeatOpenerMp3State {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const handleRef = useRef<SpeakOpenerHandle | null>(null);
  const settledRef = useRef(false);

  const stop = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    handleRef.current?.stop();
    handleRef.current = null;
    setPlaying(false);
    setProgress(1);
    setDone(true);
  }, []);

  useEffect(() => {
    if (!active || !text?.trim()) return;

    settledRef.current = false;
    setPlaying(false);
    setProgress(null);
    setDone(false);

    let el: HTMLAudioElement | null = null;
    const unsubQaSound = subscribeQaSound(() => {
      if (el) el.muted = isQaMuted();
    });

    const wordTotal = text.trim().split(/\s+/).filter(Boolean).length;
    const estMs = Math.max(MIN_ESTIMATE_MS, wordTotal * MS_PER_WORD_ESTIMATE);
    const handle = speakOpener(text, (fraction) => setProgress(fraction), estMs, {
      gestureFallback: true,
      onElement: (audioEl) => {
        el = audioEl;
        el.muted = isQaMuted();
      },
      onPlaying: () => setPlaying(true),
    });
    handleRef.current = handle;

    void handle.done.then(() => {
      if (settledRef.current) return;
      settledRef.current = true;
      handleRef.current = null;
      setPlaying(false);
      setProgress(1);
      setDone(true);
    });

    return () => {
      unsubQaSound();
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, text]);

  useEffect(() => {
    if (!active) stop();
  }, [active, stop]);

  // Cartesia streams TTS in an authed context; the B28 autoplay-hold affordance
  // is MP3-clip territory, so these stay inert here (shape parity only).
  return { playing, progress, done, blocked: false, textFallback: false, stop };
}
