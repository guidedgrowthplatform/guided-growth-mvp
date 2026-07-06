import { useRef } from 'react';
import { Orb, type OrbMic } from '@/components/orb/Orb';
import { orbIdle, orbSpeaking } from '@/components/orb/orbView';

interface OrbControlsProps {
  size: number;
  leftActive: boolean;
  rightActive: boolean;
  activeRings: 'left' | 'right' | 'ready' | 'idle' | null;
  ringCount: number;
  ringStep: number;
  intensity?: number;
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
export function OrbControls({
  size,
  leftActive,
  rightActive,
  activeRings,
  intensity,
  micAllowed,
  onToggleVoice,
  onToggleMic,
  onRequestMic,
}: OrbControlsProps) {
  const mic = useRef<OrbMic>({ on: false, amp: 0 });
  mic.current = { on: activeRings === 'right', amp: intensity ?? 0 };

  const orbProps =
    activeRings === 'left'
      ? orbSpeaking(size, 'coach', { mic })
      : activeRings === 'right'
        ? orbSpeaking(size, 'user', { mic })
        : orbIdle(size, leftActive, rightActive, { mic });

  const handleRightClick = micAllowed ? onToggleMic : onRequestMic;

  return (
    <div className="relative" style={{ width: size, height: size }} role="group" aria-label="Voice controls">
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
