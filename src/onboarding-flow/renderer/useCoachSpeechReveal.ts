/**
 * useCoachSpeechReveal, paces the BeatPlayer karaoke off the REAL coach audio.
 *
 * The karaoke reveal used to run on a fixed 110ms-per-word timer, which drifts
 * from the actual spoken line (a slow line finishes the text early, a fast line
 * lags behind). This hook reads the live voice provider and returns how many
 * words of the coach line should currently be lit, paced by whatever timing
 * signal is actually available for the active voice path.
 *
 * Three modes, in priority order (the best feasible sync given the voice path):
 *
 *   1. 'word'   , per-word timing IS available. The Direct-LLM path speaks over
 *                  the Cartesia WebSocket with add_timestamps, and tts-service's
 *                  beginSpeechTurn(onReveal) emits the accumulated spoken text on
 *                  the transcript bus, growing one word at a time AS each word's
 *                  audio onset is crossed. We count words in those assistant
 *                  partials and light exactly that many. This tracks the real
 *                  audio per word.
 *
 *   2. 'window' , no per-word data, but we know WHEN the coach starts and stops
 *                  speaking (Vapi exposes speech-start / speech-end as
 *                  isAssistantSpeaking). Over Vapi the Cartesia word timestamps
 *                  are stripped (text-only over Vapi), so this is the best we can
 *                  do there: begin the reveal when speech starts and spread the
 *                  words across the actual speaking window, snapping to the full
 *                  line the instant speech ends. The text then tracks the real
 *                  audio LENGTH even without per-word data.
 *
 *   3. 'fallback', no voice signal at all (text-only mode, Path 3 with no audio,
 *                  or voice not engaged). The hook returns mode 'fallback' and the
 *                  Karaoke component runs its original fixed-cadence timer.
 *
 * Why a count and not text: the spoken line is LLM-rendered and may not be
 * character-identical to the authored bubble text, so matching by prefix is
 * brittle. Word COUNT is robust: we light min(spokenWords, totalWords), so the
 * reveal tracks audio pace even when the wording differs slightly.
 */
import { useEffect, useRef, useState } from 'react';
import {
  useOnboardingVoice,
  type OnboardingTranscriptListener,
} from '@/contexts/useOnboardingVoiceSession';

export type RevealMode = 'word' | 'window' | 'fallback';

export interface CoachSpeechReveal {
  // Number of words to light, or null to let the Karaoke component run its own
  // fixed-cadence timer (mode 'fallback').
  revealCount: number | null;
  mode: RevealMode;
}

// Per-word speech (Cartesia ws) can pause briefly between words; only after this
// quiet gap with NO new word do we let the speech-window estimate take over.
// Keeps a slow word from flipping modes mid-line.
const WORD_SIGNAL_IDLE_MS = 1200;
// Speech-window estimate: how fast we walk words forward while the coach is
// speaking but we have no per-word data. ~160 wpm conversational ≈ 375ms/word.
// We deliberately under-run (slightly slower than typical speech) so the text
// trails the audio a touch rather than racing ahead and finishing early; the
// speech-end snap then closes any remainder cleanly.
const WINDOW_MS_PER_WORD = 360;
const WINDOW_TICK_MS = 90;

function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

/**
 * @param text   the coach line being revealed (the bubble text).
 * @param active whether this beat's coach line is the one currently playing.
 */
export function useCoachSpeechReveal(text: string, active: boolean): CoachSpeechReveal {
  const session = useOnboardingVoice();
  const subscribeTranscripts = session?.subscribeTranscripts;
  const isAssistantSpeaking = session?.isAssistantSpeaking ?? false;

  const total = countWords(text);

  // Words revealed by the per-word (transcript partial) signal.
  const [wordCount, setWordCount] = useState<number | null>(null);
  // Words revealed by the speech-window estimate.
  const [windowCount, setWindowCount] = useState<number | null>(null);

  const lastWordAtRef = useRef(0);
  const sawWordSignalRef = useRef(false);
  // Mirror windowCount so the interval resumes from where it left off across
  // speech start/stop cycles within the same line (no stale-closure reset to 0).
  const windowCountRef = useRef<number | null>(null);
  windowCountRef.current = windowCount;

  // Reset all reveal state when the line changes or this beat stops being active.
  useEffect(() => {
    setWordCount(null);
    setWindowCount(null);
    windowCountRef.current = null;
    lastWordAtRef.current = 0;
    sawWordSignalRef.current = false;
  }, [text, active]);

  // ── Mode 1: per-word from assistant transcript partials ───────────────────
  // The ws karaoke reveal arrives as assistant 'partial' transcript events whose
  // text grows one word per audio onset (tts-service beginSpeechTurn.onReveal →
  // emitAssistant(t,'partial')). Count its words and light that many. Vapi also
  // emits assistant partials, but they carry no audio timing, they arrive in
  // bursts, so they read as a coarse word signal there; the idle-gap check below
  // hands those off to the window estimate when they stall.
  useEffect(() => {
    if (!active || !subscribeTranscripts) return;
    const onTranscript: OnboardingTranscriptListener = (evt) => {
      if (evt.role !== 'assistant') return;
      if (evt.kind !== 'partial') return;
      const n = countWords(evt.text);
      if (n <= 0) return;
      lastWordAtRef.current = Date.now();
      sawWordSignalRef.current = true;
      setWordCount((prev) => {
        const next = Math.min(total, n);
        // Monotonic: a late shorter partial must never un-reveal words.
        return prev === null ? next : Math.max(prev, next);
      });
    };
    return subscribeTranscripts(onTranscript);
  }, [active, subscribeTranscripts, total]);

  // ── Mode 2: speech-window estimate ────────────────────────────────────────
  // While the coach is speaking AND no fresh per-word signal is driving the
  // reveal, walk the words forward at a steady conversational pace. On
  // speech-end, snap to the full line so the text never lags the finished audio.
  useEffect(() => {
    if (!active) {
      setWindowCount(null);
      return;
    }
    if (!isAssistantSpeaking) {
      // Speech finished (or never started under this path). If the coach DID
      // speak in this window, snap the estimate to full so any remaining words
      // light at once. If it never spoke, leave the estimate null so the
      // fallback timer owns the reveal.
      setWindowCount((prev) => (prev === null ? null : total));
      return;
    }
    // Coach is speaking, start/continue the estimated walk from where we were.
    let n = windowCountRef.current ?? 0;
    setWindowCount(n);
    let elapsed = n * WINDOW_MS_PER_WORD;
    const id = window.setInterval(() => {
      // A live per-word signal that arrived recently takes over, pause the
      // estimate so the two don't fight (per-word wins in the merge below).
      if (sawWordSignalRef.current && Date.now() - lastWordAtRef.current < WORD_SIGNAL_IDLE_MS) {
        return;
      }
      elapsed += WINDOW_TICK_MS;
      const target = Math.min(total, Math.floor(elapsed / WINDOW_MS_PER_WORD));
      if (target > n) {
        n = target;
        setWindowCount(n);
      }
    }, WINDOW_TICK_MS);
    return () => window.clearInterval(id);
  }, [active, isAssistantSpeaking, total]);

  if (!active) {
    return { revealCount: null, mode: 'fallback' };
  }

  // Per-word wins when it has produced a real signal (Direct-LLM ws karaoke).
  // Otherwise the speech-window estimate (Vapi). If neither has fired, hand back
  // null so the Karaoke component runs its fixed-cadence fallback.
  const wordSignalLive = sawWordSignalRef.current && (wordCount ?? 0) > 0;

  if (wordSignalLive) {
    return { revealCount: wordCount, mode: 'word' };
  }
  if (windowCount !== null) {
    return { revealCount: windowCount, mode: 'window' };
  }
  return { revealCount: null, mode: 'fallback' };
}
