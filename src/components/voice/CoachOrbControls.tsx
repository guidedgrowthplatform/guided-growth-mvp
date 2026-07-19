import { useEffect, useMemo, useState } from 'react';
import { OrbControls } from '@/components/voice/OrbControls';
import { useMicVoiceActivity } from '@/hooks/useMicRingIntensity';
import { CoachDailySession, type CoachOrbCallState } from '@/lib/coach/coachDailySession';

export interface CoachOrbControlsProps {
  onUnavailable: () => void;
  onLeave: () => void;
  session?: CoachDailySession;
}

export function CoachOrbControls({
  onUnavailable,
  onLeave,
  session: suppliedSession,
}: CoachOrbControlsProps) {
  const [callState, setCallState] = useState<CoachOrbCallState>('thinking');
  const [muted, setMuted] = useState(false);
  const mic = useMicVoiceActivity(!muted);
  const createdSession = useMemo(() => new CoachDailySession({ onState: setCallState }), []);
  const session = suppliedSession ?? createdSession;

  useEffect(() => {
    let alive = true;
    void session.start().catch(() => {
      if (alive) onUnavailable();
    });
    return () => {
      alive = false;
      void session.leave();
    };
  }, [onUnavailable, session]);

  const toggleMic = () => {
    void session.toggleMute();
    setMuted((value) => !value);
  };

  const leave = () => {
    void session
      .leave()
      .catch(() => undefined)
      .finally(onLeave);
  };

  return (
    <div className="relative">
      <OrbControls
        size={91}
        leftActive={!muted}
        rightActive={!muted}
        activeRings={callState === 'coach' ? 'left' : callState === 'user' ? 'right' : 'idle'}
        ringCount={3}
        ringStep={4}
        intensity={mic.intensity}
        coachIntensity={callState === 'coach' ? 1 : 0}
        micAllowed
        onToggleVoice={toggleMic}
        onToggleMic={toggleMic}
        onRequestMic={toggleMic}
      />
      <button
        type="button"
        onClick={leave}
        aria-label="Leave coach session"
        className="absolute -right-10 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-700"
      >
        Leave
      </button>
    </div>
  );
}
