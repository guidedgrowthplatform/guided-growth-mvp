import { useState } from 'react';
import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';

// The shared canvas orb, interactive like the real app orb. Each half is the real
// DualButton half: blue when on, slate-grey when off, with a WHITE icon either way.
// Click the left half to toggle the coach voice on/off, the right half to toggle
// the mic on/off.
//
// Two animations live here, and they stack:
//   - The general ring pulse: full rings gently pulsing around the whole orb
//     whenever the voice side is on. This stays on every beat (the "alive" look).
//   - The mic-ask variation: on the permission beat, the grey mic (right) half
//     itself scales in and out, as one group with its icon, ON TOP of the rings.
//
// The per-beat config sets the STARTING state; clicking toggles from there (a live
// preview, not saved).
export interface OrbConfig {
  voiceOn?: boolean;
  micOn?: boolean;
  // micAsking = the permission beat: mic starts off and the mic half pulses.
  micAsking?: boolean;
  // bloomed = the grown, speaking pose (the coach greeting), larger so a dissolve
  // from the docked splash orb reads as the orb blooming open.
  bloomed?: boolean;
  hidden?: boolean;
  // fullBleed = this beat renders a full-screen surface (the home tour) and wants
  // the screen's bottom orb-reserve removed so it can fill the phone edge to edge.
  fullBleed?: boolean;
}

const RING_COUNT = 3;
const RING_STEP = 4;

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

  // The general ring pulse stays on whenever the voice side is on (every beat,
  // including the mic-permission beat), quiet when off.
  const activeRings = voiceOn ? 'idle' : null;

  const orb = (
    <DualButton
      size={size}
      leftActive={voiceOn}
      rightActive={micOn}
      activeRings={activeRings}
      ringCount={RING_COUNT}
      ringStep={RING_STEP}
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

  // Mic-ask variation, on top of the rings: the grey mic (right) half and its icon
  // scale in and out together as one group. DualButton wraps the dial in a
  // ring-padded box (RING_STEP * RING_COUNT per side), so inset the overlay by that
  // amount to land exactly on the dial's right half. Grey-on-grey, so it sits flush
  // at rest and only the swell shows. pointer-events off so the dial stays clickable.
  const inset = RING_STEP * RING_COUNT;
  const gap = Math.max(5, Math.round(size * 0.06));
  const halfW = size / 2 - gap / 2;
  const innerR = (size * 9.24) / 187;
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {orb}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: inset,
          right: inset,
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
  // The mic beat renders the full MicPermission sequence with its own orb, so the
  // shared canvas orb is hidden here.
  'mic-permission': { hidden: true },
  // The coach greeting renders the full SplashIntro sequence with its own orb, so
  // the shared canvas orb is hidden here too.
  'splash-intro': { hidden: true },
  // QA control is a utility screen, not a coach turn: no orb.
  'qa-control': { hidden: true },
  // The home tour renders the full home page with its own coach caption + the
  // open-chat button, so the shared docked orb is hidden to avoid double chrome.
  // fullBleed lets it fill the phone edge to edge (no orb-reserve gap).
  'home-tour': { hidden: true, fullBleed: true },
};

export function orbConfigForType(type: string): OrbConfig {
  return ORB_BY_TYPE[type] ?? {};
}
