import { useState } from 'react';
import { IconChatText, IconMicMuted } from '@/components/icons';
import { Orb, type OrbStateSel, type OrbTalkStyle } from '@/components/orb/Orb';
import { loadParams, loadPulse } from './orb/orbPresets';
import { useIsPlaying } from './beatKit';

// The orb shown on the builder's screens. It IS the canonical tuned orb (same
// component + config the real app orb is built from), so what you design in the
// Orb builder is exactly what shows here.
//
// Two behaviours, driven by the two canonical presets:
//   - Idle: the resting two-half orb. Left half = the AI voice (blue), right half
//     = the mic (yellow). Each toggles on/off (click it); off is the grey half.
//   - Voice active: a full circle in the speaker's colour (blue when the AI talks,
//     yellow when you talk) with the expanding pulse. Set per beat via `talking`.
//
// The per-beat config sets the STARTING state; clicking toggles from there (a live
// preview, not saved).
export interface OrbConfig {
  voiceOn?: boolean;
  micOn?: boolean;
  // micAsking = the permission beat: mic starts off. That beat renders its own
  // sequence (hidden below), so this is just the starting state here.
  micAsking?: boolean;
  // bloomed = the grown, speaking pose (the coach greeting), a touch larger.
  bloomed?: boolean;
  hidden?: boolean;
  // fullBleed = this beat renders a full-screen surface (the home tour) and wants
  // the screen's bottom orb-reserve removed so it can fill the phone edge to edge.
  fullBleed?: boolean;
  // Voice active on this beat: 'ai' = full blue circle, 'user' = full yellow circle.
  // null/undefined = the resting idle orb.
  talking?: 'ai' | 'user' | null;
}

export function BeatOrb({
  size: baseSize = 56,
  voiceOn: voiceOn0 = true,
  micOn: micOn0 = true,
  micAsking = false,
  bloomed = false,
  hidden = false,
  talking = null,
  live = false,
}: { size?: number; live?: boolean } & OrbConfig) {
  const [voiceOn, setVoiceOn] = useState(voiceOn0);
  const [micOn, setMicOn] = useState(micAsking ? false : micOn0);
  // The look you tuned in the Orb builder (autosaved), read live. Falls back to the
  // committed app default when nothing has been tuned in this browser yet.
  const [params] = useState(() => loadParams());
  const [pulse] = useState(() => loadPulse());
  const playing = useIsPlaying();
  if (hidden) return null;

  const size = bloomed ? Math.round(baseSize * 1.15) : baseSize;
  const glyph = Math.round(size * 0.25);

  // Voice active = a full circle in the speaker's colour with the expanding pulse.
  const state: OrbStateSel = talking === 'ai' ? 'coach' : talking === 'user' ? 'user' : 'idle';
  const style: OrbTalkStyle = 'full';

  return (
    <Orb
      size={size}
      state={state}
      style={style}
      params={params}
      pulse={pulse}
      leftOn={voiceOn}
      rightOn={micOn}
      frozen={live ? false : !playing}
      onToggleLeft={() => setVoiceOn((v) => !v)}
      onToggleRight={() => setMicOn((m) => !m)}
      idleIcons={{
        // Icons only on the passive (off) side. Active stays clean.
        leftOn: null,
        leftOff: <IconChatText size={glyph} />,
        rightOn: null,
        rightOff: <IconMicMuted size={glyph} />,
      }}
    />
  );
}

// Per-beat starting state. Default is voice on + mic on (left blue, right yellow).
// The mic-permission and splash beats render their own full orb sequences, so the
// shared docked orb is hidden there.
const ORB_BY_TYPE: Record<string, OrbConfig> = {
  'mic-permission': { hidden: true },
  'splash-intro': { hidden: true },
  'qa-control': { hidden: true },
  // The home tour renders the full home page with its own coach caption; hide the
  // docked orb and let it fill the phone edge to edge.
  'home-tour': { hidden: true, fullBleed: true },
};

export function orbConfigForType(type: string): OrbConfig {
  return ORB_BY_TYPE[type] ?? {};
}
