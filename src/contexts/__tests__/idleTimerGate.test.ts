/**
 * Idle auto-pause arm gate, with the chat-native instant-opener case under test.
 *
 * Regression context: on the chat-native onboarding engine with the instant
 * opener on, Vapi joins SILENT (firstMessageMode='assistant-waits-for-user')
 * and Cartesia speaks the opener instead. Vapi's speech-start never fires, so
 * `assistantHasSpoken` was never set from the Vapi side and the 8s idle timer
 * never armed — leaving the live Vapi call burning voice minutes forever after
 * the opener with no user reply. The fix folds the opener-finished signal into
 * `assistantHasSpoken`, so this gate now returns true on the silent-Vapi path
 * once the call is idling in `listening` and the opener has played.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  idleSilenceRemainingMs,
  isUserSilenceElapsed,
  shouldArmIdleTimer,
  type IdleTimerGateInput,
} from '../idleTimerGate';

const armable: IdleTimerGateInput = {
  status: 'active',
  state: 'listening',
  assistantHasSpoken: true,
};

describe('shouldArmIdleTimer', () => {
  it('arms when active, listening, and the coach has spoken', () => {
    expect(shouldArmIdleTimer(armable)).toBe(true);
  });

  it('does NOT arm before the coach has spoken (no premature pause)', () => {
    expect(shouldArmIdleTimer({ ...armable, assistantHasSpoken: false })).toBe(false);
  });

  it('does NOT arm while the coach is still speaking', () => {
    expect(shouldArmIdleTimer({ ...armable, state: 'speaking' })).toBe(false);
  });

  it('does NOT arm in connecting/thinking/idle/error phases', () => {
    expect(shouldArmIdleTimer({ ...armable, state: 'connecting' })).toBe(false);
    expect(shouldArmIdleTimer({ ...armable, state: 'thinking' })).toBe(false);
    expect(shouldArmIdleTimer({ ...armable, state: 'idle' })).toBe(false);
    expect(shouldArmIdleTimer({ ...armable, state: 'error' })).toBe(false);
  });

  it('does NOT arm when the call is not active', () => {
    expect(shouldArmIdleTimer({ ...armable, status: 'connecting' })).toBe(false);
    expect(shouldArmIdleTimer({ ...armable, status: 'idle' })).toBe(false);
    expect(shouldArmIdleTimer({ ...armable, status: 'ended' })).toBe(false);
    expect(shouldArmIdleTimer({ ...armable, status: 'error' })).toBe(false);
  });

  it('instant-opener path: arms after Cartesia opener with Vapi idling in listening', () => {
    // Vapi joined silent (no speech-start), Cartesia opener finished →
    // assistantHasSpoken set from the opener-done callback, state stays
    // 'listening'. The timer must arm so an idle user tears the call down.
    const afterOpener: IdleTimerGateInput = {
      status: 'active',
      state: 'listening',
      assistantHasSpoken: true,
    };
    expect(shouldArmIdleTimer(afterOpener)).toBe(true);
  });

  it('instant-opener path: stays disarmed until the opener finishes', () => {
    // Mic muted, opener still playing, Vapi silent in 'listening' →
    // assistantHasSpoken not yet set → timer must NOT arm.
    const duringOpener: IdleTimerGateInput = {
      status: 'active',
      state: 'listening',
      assistantHasSpoken: false,
    };
    expect(shouldArmIdleTimer(duringOpener)).toBe(false);
  });
});

const TIMEOUT = 8000;

describe('idleSilenceRemainingMs (continuous-user-silence arithmetic)', () => {
  it('returns the full window when the user just acted', () => {
    expect(idleSilenceRemainingMs(1000, 1000, TIMEOUT)).toBe(TIMEOUT);
  });

  it('returns the leftover, not a fresh window, partway through silence', () => {
    // 3s of user silence elapsed → 5s remaining. This is what makes a re-arm
    // after an assistant re-prompt schedule for the LEFTOVER instead of 8s.
    expect(idleSilenceRemainingMs(1000, 4000, TIMEOUT)).toBe(5000);
  });

  it('clamps to 0 once the window is overdue (never negative)', () => {
    expect(idleSilenceRemainingMs(1000, 1000 + TIMEOUT + 500, TIMEOUT)).toBe(0);
  });
});

describe('isUserSilenceElapsed', () => {
  it('is false while the user has spoken within the window', () => {
    expect(isUserSilenceElapsed(1000, 1000 + TIMEOUT - 1, TIMEOUT)).toBe(false);
  });

  it('is true exactly at and beyond the threshold', () => {
    expect(isUserSilenceElapsed(1000, 1000 + TIMEOUT, TIMEOUT)).toBe(true);
    expect(isUserSilenceElapsed(1000, 1000 + TIMEOUT + 5000, TIMEOUT)).toBe(true);
  });
});

/**
 * The live-symptom regression, reproduced against the real arming arithmetic.
 *
 * User said the call "was waiting for me and it repeated itself and asked
 * again" and never auto-paused. Root cause: Vapi's own idle re-prompt at ~7.5s
 * bounced state listening→speaking→listening, the provider re-armed the idle
 * timer, and the OLD code restarted a fresh full 8s every time — so 8s of
 * CONTINUOUS silence was never reached. The fix measures silence from the last
 * USER turn (lastUserActivityAtRef), which an assistant re-prompt does NOT
 * touch, so the re-arm schedules for the leftover and the pause still fires.
 *
 * This test models the provider's armIdleTimer loop with fake timers:
 *  - lastUserActivityAt is fixed (the user never speaks).
 *  - an "assistant re-prompt" re-arms the timer mid-silence (clears + re-arms),
 *    exactly as the provider's arm effect does on a speaking→listening bounce.
 *  - assert the pause STILL fires at 8s of continuous user silence, and that
 *    the re-prompt did not push it out to a fresh 8s.
 */
describe('idle auto-pause survives an assistant re-prompt mid-silence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // Mirror of the provider's armIdleTimer: re-arm reads lastUserActivityAt and
  // schedules for the REMAINING silence; on fire, reschedule the leftover if the
  // user spoke since, otherwise pause.
  function makeIdleController(getLastUserActivityAt: () => number, onPause: () => void) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const clear = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };
    const arm = () => {
      clear();
      const fire = () => {
        timer = null;
        if (!isUserSilenceElapsed(getLastUserActivityAt(), Date.now(), TIMEOUT)) {
          timer = setTimeout(
            fire,
            idleSilenceRemainingMs(getLastUserActivityAt(), Date.now(), TIMEOUT),
          );
          return;
        }
        onPause();
      };
      timer = setTimeout(
        fire,
        idleSilenceRemainingMs(getLastUserActivityAt(), Date.now(), TIMEOUT),
      );
    };
    return { arm, clear };
  }

  it('reaches the threshold despite a re-prompt resetting the listening window', () => {
    const start = Date.now();
    // The user acts once at call start, then stays silent forever.
    const lastUserActivityAt = start;
    const pause = vi.fn();
    const ctrl = makeIdleController(() => lastUserActivityAt, pause);

    // Coach finished speaking → arm the idle timer (t=0).
    ctrl.arm();

    // Vapi's idle re-prompt fires at ~7.5s: state bounces speaking→listening, so
    // the provider re-arms. lastUserActivityAt is UNCHANGED (no user STT).
    vi.advanceTimersByTime(7500);
    ctrl.arm(); // the re-prompt re-arm — must NOT restart a fresh 8s

    // 0.5s more of continuous user silence → 8s total since the user's last turn.
    vi.advanceTimersByTime(500);
    expect(pause).toHaveBeenCalledTimes(1); // paused on continuous-silence, not pushed out

    // Sanity: had the re-prompt restarted a fresh 8s (the old bug), pause would
    // not fire until t=15500. Confirm it already fired well before then.
    vi.advanceTimersByTime(8000);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('a genuine user turn DOES push the deadline forward (barge-in intact)', () => {
    const start = Date.now();
    let lastUserActivityAt = start;
    const pause = vi.fn();
    const ctrl = makeIdleController(() => lastUserActivityAt, pause);

    ctrl.arm();
    // User speaks at t=5s (real STT activity) → deadline moves; provider would
    // also re-arm on the resulting state bounce.
    vi.advanceTimersByTime(5000);
    lastUserActivityAt = Date.now();
    ctrl.arm();

    // 7.9s after the user's turn → still under the window, no pause yet.
    vi.advanceTimersByTime(7900);
    expect(pause).not.toHaveBeenCalled();

    // Cross 8s of silence since that user turn → pause now.
    vi.advanceTimersByTime(200);
    expect(pause).toHaveBeenCalledTimes(1);
  });
});
