import { useEffect, useRef } from 'react';
import { Orb, type OrbMic } from '@/components/orb/Orb';
import { orbIdle, orbSpeaking } from '@/components/orb/orbView';
import { resolveOrbMic } from '@/lib/orb/orbState';
import { registerQaOrbLevel } from '@/lib/orb/qaOrbLevel';

interface OrbControlsProps {
  size: number;
  leftActive: boolean;
  rightActive: boolean;
  activeRings: 'left' | 'right' | 'ready' | 'idle' | null;
  ringCount: number;
  ringStep: number;
  /** User-mic amplitude (right/gold side), 0..1. */
  intensity?: number;
  /**
   * Coach amplitude (left/blue side), 0..1 (B51). Optional and defaults to 0
   * so existing callers that only pass `intensity` keep compiling; the coach
   * side just stays flat until a caller wires this in.
   */
  coachIntensity?: number;
  micAllowed: boolean;
  onToggleVoice: () => void;
  onToggleMic: () => void;
  onRequestMic: () => void;
}

// In-flow docked orb control, now built on the canonical Orb (see
// gg-spec/docs/orb-spec.md and orbView.tsx). Same two-half semantics as before:
// left = AI voice on/off (blue), right = mic on/off (gold), icons only on the
// OFF half. activeRings 'left'/'right' map to the canonical speaking states
// (full blue/gold circle); 'ready'/'idle'/null all render the idle two-half
// button, matching the prior DualButton behaviour where only 'left'/'right'
// triggered a directional speaking look.
//
// B51: the mic ref now carries BOTH directions' amplitude, whichever side is
// actually live. Previously `mic.on` was hardwired to `activeRings === 'right'`
// (user mic only), so the coach-speaking side ('left') never pulsed at all —
// the orb looked static every time the coach talked. Applying amp whenever a
// live level exists (independent of activeRings) also means a ring-state gap
// can't silently zero out real amplitude; see FlowVoiceControls for a case
// where user-mic amplitude should show even before the ring flips to 'right'.
export function OrbControls({
  size,
  leftActive,
  rightActive,
  activeRings,
  intensity,
  coachIntensity,
  micAllowed,
  onToggleVoice,
  onToggleMic,
  onRequestMic,
}: OrbControlsProps) {
  const mic = useRef<OrbMic>({ on: false, amp: 0 });
  mic.current = resolveOrbMic(activeRings, coachIntensity ?? 0, intensity ?? 0);

  // B51 QA seam: exposes window.__ggQaOrbLevel() for preview/Playwright amp
  // sampling. No-op (and stripped by the QA_SCREEN_ENABLED gate) for real users.
  useEffect(
    () =>
      registerQaOrbLevel(() => {
        const m = mic.current;
        const source: 'coach' | 'user' | 'idle' =
          activeRings === 'left' ? 'coach' : activeRings === 'right' ? 'user' : 'idle';
        return { source, amp: m.amp };
      }),
    [activeRings],
  );

  const orbProps =
    activeRings === 'left'
      ? orbSpeaking(size, 'coach', { mic })
      : activeRings === 'right'
        ? orbSpeaking(size, 'user', { mic })
        : orbIdle(size, leftActive, rightActive, { mic });

  const handleRightClick = micAllowed ? onToggleMic : onRequestMic;

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="group"
      aria-label="Voice controls"
    >
      <Orb {...orbProps} />
      <button
        type="button"
        onClick={onToggleVoice}
        aria-label={leftActive ? 'Switch to screen mode' : 'Switch to voice mode'}
        aria-pressed={leftActive}
        className="absolute inset-y-0 left-0 z-10 w-1/2 rounded-l-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
      <button
        type="button"
        onClick={handleRightClick}
        aria-label={!micAllowed ? 'Allow microphone' : rightActive ? 'Turn mic off' : 'Turn mic on'}
        aria-pressed={rightActive}
        className="absolute inset-y-0 right-0 z-10 w-1/2 rounded-r-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
    </div>
  );
}
