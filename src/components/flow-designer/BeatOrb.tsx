import { IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';

// The shared canvas orb. Uses the real app icons at the app's ~0.25 glyph
// proportion. It rests on every beat; only the mic-permission beat shows the
// "asking for the mic" look (muted mic + the pulsing grey right half).
export type OrbMode = 'rest' | 'mic-asking';

export function BeatOrb({ size = 56, mode = 'rest' }: { size?: number; mode?: OrbMode }) {
  const glyph = Math.round(size * 0.25);
  const gap = Math.max(5, Math.round(size * 0.06));
  const halfW = size / 2 - gap / 2;
  const innerR = (size * 9.24) / 187;
  const micAsking = mode === 'mic-asking';
  const orb = (
    <DualButton
      size={size}
      leftActive
      rightActive={!micAsking}
      activeRings={micAsking ? undefined : 'idle'}
      intensity={0.45}
      leftIcon={<IconChatVoice size={glyph} />}
      rightIcon={micAsking ? <IconMicMuted size={glyph} /> : <IconMic size={glyph} />}
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

// Only the mic-permission beat asks for the mic; every other beat rests.
export function orbModeForType(type: string): OrbMode {
  return type === 'mic-permission' ? 'mic-asking' : 'rest';
}
