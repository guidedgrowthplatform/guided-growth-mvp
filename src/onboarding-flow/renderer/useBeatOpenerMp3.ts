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
 * Safe to call for every beat: if the screenId has no MP3 registered, it is
 * a no-op (no fetch, no element). The hook re-fires only when screenId or
 * active changes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isQaMuted, subscribe as subscribeQaSound } from '@/onboarding-flow/qaSound';

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
 * When `active` is true and the screenId has a registered MP3, plays it on
 * mount and tracks playback progress. Stops and resets on deactivation or
 * screenId change. No-op for unregistered screenIds.
 */
export function useBeatOpenerMp3(screenId: string, active: boolean): BeatOpenerMp3State {
  const src = ONBOARDING_BEAT_MP3S[screenId] ?? null;

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const settledRef = useRef(false);

  const stopProgress = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const settle = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    stopProgress();
    const el = audioRef.current;
    if (el) {
      el.onended = null;
      el.onerror = null;
      try { el.pause(); } catch { /* ignore */ }
      audioRef.current = null;
    }
    setPlaying(false);
    setProgress(1);
    setDone(true);
  }, [stopProgress]);

  const stop = useCallback(() => {
    settle();
  }, [settle]);

  useEffect(() => {
    if (!active || !src) {
      return;
    }

    // Reset for this activation.
    settledRef.current = false;
    setPlaying(false);
    setProgress(null);
    setDone(false);

    const el = new Audio(src);
    el.preload = 'auto';
    // Apply QA mute state at creation so the element is pre-configured.
    el.muted = isQaMuted();
    audioRef.current = el;

    // Mirror live QA mute toggles onto the element so toggling mid-clip works.
    const unsubQaSound = subscribeQaSound(() => {
      if (audioRef.current) {
        audioRef.current.muted = isQaMuted();
      }
    });

    el.onended = () => {
      stopProgress();
      setProgress(1);
      settle();
    };
    el.onerror = () => {
      if (import.meta.env.DEV) {
        console.warn('[useBeatOpenerMp3] failed to play', src);
      }
      settle();
    };

    // Start the rAF progress loop once playing.
    const startProgressLoop = () => {
      const tick = () => {
        if (settledRef.current || !audioRef.current) return;
        const d = audioRef.current.duration;
        if (d && Number.isFinite(d) && d > 0) {
          setProgress(Math.min(1, audioRef.current.currentTime / d));
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    el.play()
      .then(() => {
        setPlaying(true);
        startProgressLoop();
      })
      .catch((err) => {
        // Autoplay blocked (iOS before gesture, or audio policy). Resolve cleanly
        // so the karaoke falls back to its fixed-cadence timer and the beat
        // doesn't dead-end.
        if (import.meta.env.DEV) {
          console.warn('[useBeatOpenerMp3] autoplay blocked:', err);
        }
        settle();
      });

    return () => {
      // Beat deactivated or unmounted — stop and release.
      unsubQaSound();
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenId, active, src]);

  // When active flips to false, stop any in-flight audio.
  useEffect(() => {
    if (!active) {
      stop();
    }
  }, [active, stop]);

  return { playing, progress, done, stop };
}
