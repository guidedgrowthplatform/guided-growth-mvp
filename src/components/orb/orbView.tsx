import type { MutableRefObject, ReactNode } from 'react';
import { IconChatText, IconMicMuted } from '@/components/icons';
import { DEFAULT_PARAMS, DEFAULT_PULSE } from './orbConfig';
import type { OrbMic, OrbStateSel, OrbTalkStyle } from './Orb';

// Canonical orb rendering per the spec (gg-spec/docs/orb-spec.md). Always build the
// orb's props through these helpers so it can never be rendered wrong:
//   - Idle = the two-half resting button (Aurora Bloom). Icons ONLY on the off
//     (gray) half, nudged toward the center seam. Left off = text symbol, right off
//     = mic-off. Never an icon on an active/colored side.
//   - Speaking = the full circle in the speaker's color (Aurora), no icons. Coach =
//     blue, user = yellow. Pass a mic/amplitude ref so the pulse rides the sound.
// Spread the result onto <Orb {...} /> and add per-use handlers (onToggleLeft, etc).

const PARAMS = DEFAULT_PARAMS;
const PULSE = DEFAULT_PULSE;

function idleIcons(size: number): {
  leftOn: ReactNode;
  rightOn: ReactNode;
  leftOff: ReactNode;
  rightOff: ReactNode;
} {
  const glyph = Math.round(size * 0.25);
  return {
    leftOn: null,
    rightOn: null,
    leftOff: <IconChatText size={glyph} />,
    rightOff: <IconMicMuted size={glyph} />,
  };
}

export interface OrbViewOpts {
  /** Shared amplitude ref so the orb pulses with the live sound (mic or coach audio). */
  mic?: MutableRefObject<OrbMic>;
  /** Static single frame, no animation loop (builder canvas / many-at-once). */
  frozen?: boolean;
}

// Idle: the two-half resting button. leftOn = AI voice on/off, rightOn = mic on/off.
export function orbIdle(size: number, leftOn: boolean, rightOn: boolean, opts: OrbViewOpts = {}) {
  return {
    size,
    state: 'idle' as OrbStateSel,
    style: 'full' as OrbTalkStyle,
    params: PARAMS,
    pulse: PULSE,
    leftOn,
    rightOn,
    idleIcons: idleIcons(size),
    frozen: opts.frozen,
    mic: opts.mic,
  };
}

// Speaking: the full circle in the speaker's color, no icons. who = 'coach' (blue)
// or 'user' (yellow).
export function orbSpeaking(size: number, who: 'coach' | 'user', opts: OrbViewOpts = {}) {
  return {
    size,
    state: who as OrbStateSel,
    style: 'full' as OrbTalkStyle,
    params: PARAMS,
    pulse: PULSE,
    frozen: opts.frozen,
    mic: opts.mic,
  };
}
