/**
 * useBeatOpenerMp3 — plays a pre-encoded MP3 opener when a beat becomes active.
 *
 * For the v3 onboarding beats (and selected v1 beats) we ship Yair Pro Clone V1
 * single-take WAVs encoded to MP3 and served from public/voice/. These replace
 * the runtime Cartesia TTS call for the opener (the first coach line on a beat).
 *
 * Approach: the MP3 is served as a static asset under public/voice/ and played
 * via a bare HTMLAudioElement — same pattern as SplashIntro / IntroGate, which
 * already works on both web and native (Capacitor serves public/ assets at the
 * root URL). No VoiceContext mutual-exclusion is needed here because Vapi is
 * muted during the opener on ONBOARDING_INSTANT_OPENER beats, and for
 * non-Vapi beats the existing BeatPlayer timer takes the karaoke reveal anyway.
 *
 * For the two hybrid beats (ONBOARD-BEGINNER-04 = habit-schedule,
 * ONBOARD-ADVANCED = advanced-capture): the MP3 plays at beat mount as the
 * opener, then Vapi resumes normally. The caller does NOT suppress Vapi for these
 * beats — only the opener audio is replaced.
 *
 * For the five weekly-projection beats: each fires independently when its frame
 * becomes the active beat (the WeeklyProjection component advances through them
 * one at a time).
 *
 * Returns:
 *   - onProgress(fraction)  — 0..1 playback position; use to drive karaoke
 *   - playing               — true while the audio element is playing
 *   - done                  — resolves when the clip finishes (or fails)
 *   - stop()                — stop and release the element
 *
 * Safe to call for every beat: if the beat has no MP3 source, it is a no-op
 * (no fetch, no element). The hook re-fires only when src or active changes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { attemptPlayWithGestureFallback } from '@/lib/audio/attempt-play-with-gesture-fallback';
import { isQaMuted, subscribe as subscribeQaSound } from '@/onboarding-flow/qaSound';
import {
  classifyOpenerPlayFailure,
  createActivationTracker,
  type OpenerActivationTracker,
} from './openerActivation';
import { claimPreloadedClip } from './openerPreloadPool';

// How many times a live activation re-arms play() after an AbortError (the
// shared pooled element got paused under a pending play()) before settling by
// failure. Intentional teardowns never reach the retry path — they are scoped
// out by the activation token / teardown-abort checks.
const ABORT_REPLAY_ATTEMPTS = 2;

// ─── Clip registry ──────────────────────────────────────────────────────────
// Maps canonical screenId -> public/voice/*.mp3 path.
// profile (ONBOARD-01--FORM) is intentionally absent: it speaks the user's name
// so the opener stays live Cartesia at runtime.
// splash_welcome.mp3 is the SEPARATE orb-bloom intro (IntroGate/SplashIntro)
// and is NOT wired here; coach_greeting is the COACH-GREETING beat opener.
export const ONBOARDING_BEAT_MP3S: Readonly<Record<string, string>> = {
  'COACH-GREETING': '/voice/onboard_coach_greeting.mp3',
  'MIC-PERMISSION': '/voice/onboard_mic_permission.mp3',
  'ONBOARD-WHY-INTRO': '/voice/onboard_why_intro.mp3',
  'ONBOARD-STATE-CHECK': '/voice/onboard_state_check.mp3',
  'ONBOARD-MORNING-SETUP': '/voice/onboard_morning_time.mp3',
  'ONBOARD-BEGINNER-07': '/voice/onboard_evening_reflection.mp3',
  'ONBOARD-FORK--FORM': '/voice/onboard_path_fork.mp3',
  'ONBOARD-BEGINNER-01': '/voice/onboard_category.mp3',
  'ONBOARD-BEGINNER-02': '/voice/onboard_subcategory.mp3',
  'ONBOARD-BEGINNER-03': '/voice/onboard_habits.mp3',
  // Hybrid beats: opener MP3 plays, then Vapi continues the conversation.
  'ONBOARD-BEGINNER-04': '/voice/onboard_habit_schedule.mp3',
  'ONBOARD-ADVANCED': '/voice/onboard_advanced_capture.mp3',
  'ONBOARD-ADVANCED-FREQUENCY': '/voice/onboard_advanced_frequency.mp3',
  'ONBOARD-COMPLETE': '/voice/onboard_full_plan.mp3',
  // Weekly projection — one clip per frame.
  'ONBOARD-WEEKLY-PROJECTION-BLANK': '/voice/onboard_weekly_blank.mp3',
  'ONBOARD-WEEKLY-PROJECTION-FULL': '/voice/onboard_weekly_full.mp3',
  'ONBOARD-WEEKLY-PROJECTION-P78': '/voice/onboard_weekly_p78.mp3',
  'ONBOARD-WEEKLY-PROJECTION-P36': '/voice/onboard_weekly_p36.mp3',
  'ONBOARD-WEEKLY-PROJECTION-GAPS': '/voice/onboard_weekly_gaps.mp3',
};

// Beats where the MP3 is only the opener; Vapi continues the conversation
// after the audio ends. These do NOT suppress Vapi for the rest of the beat.
export const HYBRID_OPENER_BEATS: ReadonlySet<string> = new Set([
  'ONBOARD-BEGINNER-04',
  'ONBOARD-ADVANCED',
]);

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface BeatOpenerMp3State {
  /** True while the audio element is actively playing. */
  playing: boolean;
  /** True once playback has ended, failed, or been stopped for this activation. */
  done: boolean;
  /**
   * Playback fraction 0..1, updated via requestAnimationFrame.
   * null until the audio starts (so the caller can gate karaoke on it).
   */
  progress: number | null;
  /** Stop playback and release the element. */
  stop: () => void;
}

/**
 * When `active` is true and an MP3 source is present, plays it on mount and
 * tracks playback progress. Stops and resets on deactivation or source change.
 * No-op when src is null.
 */
export function useBeatOpenerMp3(src: string | null, active: boolean): BeatOpenerMp3State {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  // One tracker per hook instance; each effect run begins its own activation.
  // React can run the effect twice for one logical activation (strict-mode
  // double invoke / dep-change re-run) and the pooled element is shared, so a
  // run's late play() AbortError must be scoped to ITS activation — a stale
  // run settling the live one was the B4 "done with zero audio" race.
  const trackerRef = useRef<OpenerActivationTracker | null>(null);
  if (trackerRef.current === null) trackerRef.current = createActivationTracker();
  // settle() of the CURRENT activation, for the external stop() / deactivation
  // path. Stale settles are no-ops by the activation-token rules.
  const settleCurrentRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    settleCurrentRef.current?.();
  }, []);

  useEffect(() => {
    if (!active || !src) {
      return;
    }

    const activation = trackerRef.current!.begin();

    // Reset for this activation.
    setPlaying(false);
    setProgress(null);
    setDone(false);

    // Preloaded element when the pool has it (buffered at flow mount, B15) and
    // no other consumer holds it (the claim serializes the handout); fresh
    // element as the lazy fallback when preloading missed, failed, or the
    // element is already claimed.
    const pooled = claimPreloadedClip(src);
    const el = pooled?.el ?? new Audio(src);
    if (!pooled) el.preload = 'auto';
    try {
      el.currentTime = 0;
    } catch {
      /* not yet seekable — starts at 0 anyway */
    }
    // Apply QA mute state at creation so the element is pre-configured.
    el.muted = isQaMuted();

    // Mirror live QA mute toggles onto the element so toggling mid-clip works.
    const unsubQaSound = subscribeQaSound(() => {
      el.muted = isQaMuted();
    });

    let rafId: number | null = null;
    const stopProgress = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    let warned = false;
    const warnFailure = (reason: string, detail?: unknown) => {
      // One quiet warn per failed clip: enough for a deployed build to surface
      // the failure class, without per-activation diagnostic noise.
      if (warned) return;
      warned = true;
      console.warn(`[useBeatOpenerMp3] ${reason}`, src, detail ?? '');
    };

    const settle = () => {
      // Only the current activation may touch the (shared, pooled) element and
      // the hook state; a stale activation records itself settled and exits.
      if (!activation.settle()) return;
      stopProgress();
      el.onended = null;
      el.onerror = null;
      try {
        el.pause();
        // Pooled elements are reused across activations — rewind for next time.
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
      pooled?.release();
      setPlaying(false);
      setProgress(1);
      setDone(true);
    };
    settleCurrentRef.current = settle;

    el.onended = () => {
      settle();
    };
    el.onerror = () => {
      warnFailure('failed to play', el.error?.code);
      settle();
    };

    // Start the rAF progress loop once playing.
    const startProgressLoop = () => {
      const tick = () => {
        if (activation.isSettled()) return;
        const d = el.duration;
        if (d && Number.isFinite(d) && d > 0) {
          setProgress(Math.min(1, el.currentTime / d));
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    };

    // Autoplay rejection (no user gesture yet, e.g. a refresh landing directly
    // on this beat) defers to the next pointer/key gesture instead of settling
    // into a silent beat (B4). Abort tears the wait down on deactivation.
    const abort = new AbortController();
    const playGated = async () => {
      // First play gates on canplaythrough so a cold buffer can't clip the
      // first word (B14) — bounded so a stalled preload can't dead-end the beat.
      if (pooled && !pooled.ready) {
        await Promise.race([
          pooled.readyPromise,
          new Promise((resolve) => setTimeout(resolve, 2500)),
        ]);
      }
      if (activation.isSettled() || abort.signal.aborted) {
        throw new DOMException('Playback attempt aborted', 'AbortError');
      }
      await attemptPlayWithGestureFallback(el, { defer: true, signal: abort.signal });
    };
    const attempt = (retriesLeft: number) => {
      playGated()
        .then(() => {
          if (activation.isSettled() || !activation.isCurrent()) return;
          setPlaying(true);
          startProgressLoop();
        })
        .catch((err: unknown) => {
          // Structural read: DOMException does not extend Error in every
          // environment, and play() rejections are DOMExceptions.
          const errorName =
            typeof (err as { name?: unknown } | null | undefined)?.name === 'string'
              ? (err as { name: string }).name
              : null;
          const action = classifyOpenerPlayFailure({
            errorName,
            isCurrent: activation.isCurrent(),
            isSettled: activation.isSettled(),
            teardownAborted: abort.signal.aborted,
            retriesLeft,
          });
          if (action === 'ignore') return;
          if (action === 'retry') {
            // AbortError on the live activation: something paused the shared
            // element under our pending play(). Re-arm instead of marking the
            // beat done-with-no-audio.
            attempt(retriesLeft - 1);
            return;
          }
          warnFailure('opener failed', errorName ?? err);
          settle();
        });
    };
    attempt(ABORT_REPLAY_ATTEMPTS);

    return () => {
      // Beat deactivated or unmounted — stop and release. settle() is scoped
      // to this activation, so a strict-mode re-run's fresh activation is
      // untouched by this cleanup's async fallout.
      abort.abort();
      unsubQaSound();
      settle();
      // Belt and braces: release the claim even if a stale settle skipped it.
      pooled?.release();
      if (settleCurrentRef.current === settle) settleCurrentRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, src]);

  // When active flips to false, stop any in-flight audio.
  useEffect(() => {
    if (!active) {
      stop();
    }
  }, [active, stop]);

  return { playing, progress, done, stop };
}
