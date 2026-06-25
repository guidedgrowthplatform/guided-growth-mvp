import { useState } from 'react';
import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';

// The shared canvas orb, interactive like the real app orb. Each half is the real
// DualButton half: blue when on, slate-grey when off, with a WHITE icon either way.
// Click the left half to toggle the coach voice on/off, the right half to toggle
// the mic on/off.
//
// The per-beat config sets the STARTING state; clicking toggles from there (a live
// preview, not saved).
export interface OrbConfig {
  voiceOn?: boolean;
  micOn?: boolean;
  // micAsking = the permission beat: mic starts off and the mic (right) half itself
  // pulses, scaling in and out as one group with its icon (no rings).
  micAsking?: boolean;
  // bloomed = the grown, speaking pose (the coach greeting), larger so a dissolve
  // from the docked splash orb reads as the orb blooming open.
  bloomed?: boolean;
  hidden?: boolean;
}

export function BeatOrb({
  size: baseSize = 56,
  voiceOn: voiceOn0 = true,
  micOn: micOn0 = true,
  micAsking = false,
  bloomed = false,
  hidden = false,
}: { size?: number } & OrbConfig) {
  const [voiceOn, setVoiceOn] = useState(voiceOn0);
  const [micOn, setMicOn] = useState(micOn0);
  if (hidden) return null;

  const size = bloomed ? Math.round(baseSize * 1.15) : baseSize;
  const glyph = Math.round(size * 0.25);
  // The mic permission beat asks until the user turns the mic on.
  const asking = micAsking && !micOn;

  // No rings on the mic-permission beat: the mic half pulses instead. Otherwise the
  // gentle live pulse when the voice side is on, quiet when off. undefined = plain
  // dial (no ring padding) so the mic-half pulse overlay aligns to the dial.
  const activeRings = asking ? undefined : voiceOn ? 'idle' : null;

  const orb = (
    <DualButton
      size={size}
      leftActive={voiceOn}
      rightActive={micOn}
      activeRings={activeRings}
      ringCount={3}
      ringStep={4}
      intensity={0.45}
      leftIcon={voiceOn ? <IconChatVoice size={glyph} /> : <IconChatText size={glyph} />}
      rightIcon={micOn ? <IconMic size={glyph} /> : <IconMicMuted size={glyph} />}
      onLeftClick={() => setVoiceOn((v) => !v)}
      onRightClick={() => setMicOn((m) => !m)}
      ariaLabel="Voice orb"
      leftAriaLabel={voiceOn ? 'Coach voice on' : 'Coach voice off'}
      rightAriaLabel={micOn ? 'Mic on' : 'Mic off'}
    />
  );

  if (!asking) return orb;

  // Mic-asking: the grey mic (right) half and its icon scale in and out together as
  // one group, the approved pulse. The overlay is grey-on-grey so it sits flush at
  // rest and only the swell shows. pointer-events off so the dial half stays clickable.
  const gap = Math.max(5, Math.round(size * 0.06));
  const halfW = size / 2 - gap / 2;
  const innerR = (size * 9.24) / 187;
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
          color: '#fff',
          transformOrigin: '0% 50%',
          animation: 'ggMicPulse 1.9s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      >
        <IconMicMuted size={glyph} />
      </div>
      <style>{`@keyframes ggMicPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}`}</style>
    </div>
  );
}

// Per-beat starting state. Default is voice on + mic on (both blue). Only the
// mic-permission beat starts with the mic off and pulsing. Every orb is clickable
// to toggle from there.
const ORB_BY_TYPE: Record<string, OrbConfig> = {
  'mic-permission': { micOn: false, micAsking: true },
  'splash-intro': { bloomed: true },
};

export function orbConfigForType(type: string): OrbConfig {
  return ORB_BY_TYPE[type] ?? {};
}
