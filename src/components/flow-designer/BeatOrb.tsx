import { useState } from 'react';
import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';

// The shared canvas orb, interactive like the real app orb. Each half is the real
// DualButton half: blue when on, slate-grey when off, with a WHITE icon either way.
// Click the left half to toggle the coach voice on/off, the right half to toggle
// the mic on/off. The rings pulse when the voice side is on (the "talking" look),
// or invite on the mic side for the permission beat.
//
// The per-beat config sets the STARTING state; clicking toggles from there (a live
// preview, not saved).
export interface OrbConfig {
  voiceOn?: boolean;
  micOn?: boolean;
  // micAsking = the permission beat: mic starts off and the mic side pulses to invite.
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

  const size = bloomed ? Math.round(baseSize * 1.7) : baseSize;
  const glyph = Math.round(size * 0.25);

  // Rings: invite the mic (right side) while the permission beat's mic is still
  // off; otherwise the gentle live pulse when the voice side is on; quiet when off.
  const activeRings = micAsking && !micOn ? 'right' : voiceOn ? 'idle' : null;

  return (
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
}

// Per-beat starting state. Default is voice on + mic on (both blue). Only the
// mic-permission beat starts with the mic off and inviting. Every orb is clickable
// to toggle from there.
const ORB_BY_TYPE: Record<string, OrbConfig> = {
  'mic-permission': { micOn: false, micAsking: true },
  'splash-intro': { bloomed: true },
};

export function orbConfigForType(type: string): OrbConfig {
  return ORB_BY_TYPE[type] ?? {};
}
