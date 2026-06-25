import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';

// The shared canvas orb. Each half mirrors the real app orb: blue when on, grey
// when off, with the matching icon. Configure it per beat:
//   voiceOn  - left half: true = voice (blue), false = screen mode (grey)
//   micOn    - right half: true = mic on (blue), false = muted (grey)
//   micAsking - the mic-permission look: mic forced off + the pulsing grey half
//   hidden   - no orb on this beat at all
// Real app icons at the app's 0.25 glyph proportion.
export interface OrbConfig {
  voiceOn?: boolean;
  micOn?: boolean;
  micAsking?: boolean;
  hidden?: boolean;
}

export function BeatOrb({
  size = 56,
  voiceOn = true,
  micOn = true,
  micAsking = false,
  hidden = false,
}: { size?: number } & OrbConfig) {
  if (hidden) return null;
  const glyph = Math.round(size * 0.25);
  const gap = Math.max(5, Math.round(size * 0.06));
  const halfW = size / 2 - gap / 2;
  const innerR = (size * 9.24) / 187;
  const rightOn = micAsking ? false : micOn;
  const orb = (
    <DualButton
      size={size}
      leftActive={voiceOn}
      rightActive={rightOn}
      activeRings={micAsking ? undefined : 'idle'}
      intensity={0.45}
      leftIcon={voiceOn ? <IconChatVoice size={glyph} /> : <IconChatText size={glyph} />}
      rightIcon={rightOn ? <IconMic size={glyph} /> : <IconMicMuted size={glyph} />}
      ariaLabel="Voice orb"
    />
  );
  if (!micAsking) return orb;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {orb}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: halfW,
          height: size,
          background: '#94a3b8',
          borderRadius: `${innerR}px ${size / 2}px ${size / 2}px ${innerR}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transformOrigin: '0% 50%',
          animation: 'ggMicPulse 1.9s ease-in-out infinite',
        }}
      >
        <IconMicMuted size={glyph} />
      </div>
      <style>{`@keyframes ggMicPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}`}</style>
    </div>
  );
}

// Per-beat orb config. Default is the resting orb (both halves blue). Only the
// mic-permission beat asks for the mic. Set more here as beats need them
// (e.g. voice off on a screen-only beat, or hidden where a beat draws its own orb).
const ORB_BY_TYPE: Record<string, OrbConfig> = {
  'mic-permission': { micAsking: true },
};

export function orbConfigForType(type: string): OrbConfig {
  return ORB_BY_TYPE[type] ?? {};
}
