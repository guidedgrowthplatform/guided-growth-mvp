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
 *
 * `ownership` (B40): same beatAudioOwner contract as useBeatOpenerMp3. When
 * provided, this hook claims the beat's audio before speaking; a denied claim
 * (another owner already armed for this beat) backs off entirely - no
 * speakOpener() call, settles immediately as done with no audio.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { speakOpener, type SpeakOpenerHandle } from '@/lib/voice/speakOpener';
import { isQaMuted, subscribe as subscribeQaSound } from '@/onboarding-flow/qaSound';
import { type BeatAudioOwnerKind, claimBeatAudio, releaseBeatAudio } from './beatAudioOwner';
import type { BeatOpenerMp3State } from './useBeatOpenerMp3';

// ~310ms/word spoken-cadence estimate, used only when the audio element can't
// report a finite duration (Chrome blob-MP3 Infinity bug) — mirrors the
// instant-opener path in OnboardingVoiceProvider.
const MS_PER_WORD_ESTIMATE = 310;
const MIN_ESTIMATE_MS = 1200;

export function useBeatOpenerCartesia(
  text: string | null,
  active: boolean,
  ownership?: { beatId: string; owner: BeatAudioOwnerKind },
): BeatOpenerMp3State {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [revealWords, setRevealWords] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const handleRef = useRef<SpeakOpenerHandle | null>(null);
  const settledRef = useRef(false);
  // Same reasoning as useBeatOpenerMp3: read fresh inside the effect without
  // making ownership identity an effect dep (it tracks the caller's props,
  // not a value this hook should re-trigger speech on).
  const ownershipRef = useRef(ownership);
  ownershipRef.current = ownership;
  // Whether THIS activation holds the beat-audio claim (false when a claim
  // was denied, or when ownership is not in use - so release is a no-op).
  const ownedThisActivationRef = useRef(false);

  const releaseClaim = useCallback(() => {
    if (!ownedThisActivationRef.current || !ownershipRef.current) return;
    ownedThisActivationRef.current = false;
    releaseBeatAudio(ownershipRef.current.beatId, ownershipRef.current.owner);
  }, []);

  const stop = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    handleRef.current?.stop();
    handleRef.current = null;
    setPlaying(false);
    // null (not a stale mid-clip count) so the progress:1 full reveal wins.
    setRevealWords(null);
    setProgress(1);
    setDone(true);
    releaseClaim();
  }, [releaseClaim]);

  useEffect(() => {
    if (!active || !text?.trim()) return;

    // B40: claim this beat's audio before speaking. Denied (another owner
    // already armed for this beat) -> back off entirely, settle immediately
    // as done with no audio played. claimBeatAudio() logs the console.warn.
    const owns = ownershipRef.current
      ? claimBeatAudio(ownershipRef.current.beatId, ownershipRef.current.owner)
      : true;
    ownedThisActivationRef.current = owns;
    if (!owns) {
      settledRef.current = true;
      setPlaying(false);
      setProgress(1);
      setRevealWords(null);
      setDone(true);
      return;
    }

    settledRef.current = false;
    setPlaying(false);
    setProgress(null);
    setRevealWords(null);
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
      onRevealWords: (count) => setRevealWords(count),
    });
    handleRef.current = handle;

    void handle.done.then(() => {
      if (settledRef.current) return;
      settledRef.current = true;
      handleRef.current = null;
      setPlaying(false);
      setRevealWords(null);
      setProgress(1);
      setDone(true);
      releaseClaim();
    });

    return () => {
      unsubQaSound();
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, text, releaseClaim]);

  useEffect(() => {
    if (!active) stop();
  }, [active, stop]);

  // Cartesia streams TTS in an authed context; the B28 autoplay-hold affordance
  // is MP3-clip territory, so these stay inert here (shape parity only).
  return { playing, progress, revealWords, done, blocked: false, textFallback: false, stop };
}
