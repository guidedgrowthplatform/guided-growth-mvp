// Orb PRESET LIBRARY + persistence for the flow builder's Orb tuner. The canonical
// orb config (the param types + the locked DEFAULT look) lives in the app-owned
// @/components/orb/orbConfig; this file holds the author preset library, the motion
// presets, and the browser persistence. Version-controlled: add your own author
// block on your branch and open an MR, no merge conflicts between blocks.
import {
  DEFAULT_PARAMS,
  DEFAULT_PULSE,
  type OrbParams,
  type OrbStates,
  type PulseParams,
} from '@/components/orb/orbConfig';

// Re-export the canonical config so existing importers keep working through here.
export { DEFAULT_PARAMS, DEFAULT_PULSE };
export type { OrbParams, OrbStates, PulseParams };

// The bottom-bar skin the tuner and app shell can switch between.
export type BarStyle = 'white' | 'glass' | 'floating';

// Named quick-fill presets, grouped by author. A preset is a partial set of
// params applied to whichever state (idle or talking) is currently selected.
// To add your own: add a block keyed by your name. Example at the bottom.
export const AUTHOR_PRESETS: Record<string, Record<string, Partial<OrbParams>>> = {
  Yair: {
    Start: {
      glass: 35,
      blur: 12,
      hi: 0,
      rim: 0,
      body: 34,
      glow: 111,
      bright: 116,
      speed: 15,
      grad: 0,
      core: 59,
      spread: 41,
      pglow: 71,
      rand: 54,
      pulse: 50,
    },
    Calm: {
      glass: 55,
      glow: 110,
      bright: 96,
      speed: 26,
      grad: 66,
      rim: 56,
      body: 34,
      core: 82,
      spread: 22,
      pglow: 42,
      rand: 18,
    },
    Recommended: {
      glass: 45,
      glow: 120,
      bright: 100,
      speed: 45,
      grad: 70,
      rim: 55,
      body: 38,
      core: 72,
      spread: 30,
      pglow: 55,
      rand: 40,
    },
    Nebula: {
      glass: 30,
      glow: 130,
      bright: 118,
      speed: 56,
      grad: 82,
      rim: 46,
      body: 50,
      core: 58,
      spread: 52,
      pglow: 70,
      rand: 82,
    },
    Sparkle: {
      glass: 38,
      glow: 125,
      bright: 126,
      speed: 62,
      grad: 78,
      rim: 50,
      body: 44,
      core: 46,
      spread: 40,
      pglow: 88,
      rand: 70,
    },
    Minimal: {
      glass: 66,
      glow: 96,
      bright: 82,
      speed: 22,
      grad: 50,
      rim: 60,
      body: 28,
      core: 70,
      spread: 20,
      pglow: 34,
      rand: 16,
    },
  },
  // Timothy's looks, translated from my standalone orb builder (living glass,
  // flowing inner color, organic outer membrane). Each is applied to whichever
  // state (idle or talking) is selected in the tuner.
  Timothy: {
    'Twin Glass': {
      glass: 48,
      blur: 16,
      hi: 40,
      rim: 30,
      body: 30,
      glow: 100,
      bright: 104,
      speed: 18,
      grad: 20,
      core: 68,
      spread: 20,
      pglow: 40,
      rand: 20,
      pulse: 45,
      aura: 15,
      iris: 22,
      depth: 42,
    },
    'Living Flow': {
      glass: 34,
      blur: 12,
      hi: 20,
      rim: 25,
      body: 40,
      glow: 140,
      bright: 124,
      speed: 66,
      grad: 80,
      core: 60,
      spread: 48,
      pglow: 78,
      rand: 60,
      pulse: 60,
      aura: 45,
      iris: 15,
      depth: 30,
    },
    Membrane: {
      glass: 30,
      blur: 14,
      hi: 15,
      rim: 40,
      body: 46,
      glow: 155,
      bright: 118,
      speed: 40,
      grad: 74,
      core: 54,
      spread: 54,
      pglow: 72,
      rand: 74,
      pulse: 58,
      aura: 82,
      iris: 25,
      depth: 25,
    },
    Aurora: {
      glass: 38,
      blur: 10,
      hi: 50,
      rim: 70,
      body: 42,
      glow: 132,
      bright: 130,
      speed: 58,
      grad: 84,
      core: 48,
      spread: 44,
      pglow: 90,
      rand: 66,
      pulse: 55,
      aura: 40,
      iris: 72,
      depth: 30,
    },
    // Aurora Bloom = Membrane's breathing aura + Aurora's iridescent rim, combined.
    'Aurora Bloom': {
      glass: 34,
      blur: 12,
      hi: 42,
      rim: 55,
      body: 44,
      glow: 150,
      bright: 126,
      speed: 52,
      grad: 82,
      core: 52,
      spread: 52,
      pglow: 86,
      rand: 72,
      pulse: 58,
      aura: 78,
      iris: 66,
      depth: 32,
    },
    'Calm Dawn': {
      glass: 60,
      blur: 20,
      hi: 45,
      rim: 50,
      body: 26,
      glow: 98,
      bright: 92,
      speed: 20,
      grad: 46,
      core: 78,
      spread: 18,
      pglow: 38,
      rand: 16,
      pulse: 42,
      aura: 26,
      iris: 12,
      depth: 55,
    },
  },
};

const LS_KEY = 'gg-flow-builder-v18:orb-params';

function clone(s: OrbStates): OrbStates {
  return JSON.parse(JSON.stringify(s)) as OrbStates;
}

// Live edits persist in the browser (localStorage). Once a look is worth keeping,
// copy its numbers into AUTHOR_PRESETS above so it lands in git and everyone gets it.
export function loadParams(): OrbStates {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s) {
      // Merge onto defaults so looks saved before new fields (aura/iris/depth)
      // existed get sensible 0 values instead of undefined.
      const p = JSON.parse(s) as Partial<OrbStates>;
      return {
        idle: { ...DEFAULT_PARAMS.idle, ...(p.idle ?? {}) },
        talk: { ...DEFAULT_PARAMS.talk, ...(p.talk ?? {}) },
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return clone(DEFAULT_PARAMS);
}

export function saveParams(p: OrbStates): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    // ignore quota / private mode
  }
}

export function resetParams(): OrbStates {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }
  return clone(DEFAULT_PARAMS);
}

// PulseParams + DEFAULT_PULSE are the canonical motion config (imported + re-exported
// from orbConfig at the top of this file).

// Quick-apply MOTION presets (full PulseParams). These set only how things move
// (disc vs outer membrane vs inner light), separate from the look presets in
// AUTHOR_PRESETS. Apply from the Pulse tab.
export const MOTION_PRESETS: Record<string, PulseParams> = {
  'Yair default': { size: 8, amt: 60, speed: 50, orbAmt: 100, mem: 60, memSpeed: 35 },
  // Orb disc holds still; only the outer membrane breathes, slowly.
  'Calm membrane': { size: 8, amt: 40, speed: 30, orbAmt: 0, mem: 62, memSpeed: 20 },
  // Orb disc still, no membrane; only the inner light drifts.
  'Inner only': { size: 6, amt: 40, speed: 42, orbAmt: 0, mem: 0, memSpeed: 20 },
  // Everything moves, but gently and slow.
  'Gentle all': { size: 6, amt: 45, speed: 26, orbAmt: 58, mem: 55, memSpeed: 24 },
};
const LS_PULSE = 'gg-flow-builder-v18:orb-pulse';
export function loadPulse(): PulseParams {
  try {
    const s = localStorage.getItem(LS_PULSE);
    if (s) return { ...DEFAULT_PULSE, ...(JSON.parse(s) as Partial<PulseParams>) };
  } catch {
    // ignore
  }
  return { ...DEFAULT_PULSE };
}
export function savePulse(p: PulseParams): void {
  try {
    localStorage.setItem(LS_PULSE, JSON.stringify(p));
  } catch {
    // ignore
  }
}

// --- User-saved presets (state-tagged: an idle look or a talking look) --------
// Saved live from the tuner and kept in localStorage. Each carries the state it
// was captured for, so the card can show them as e.g. "<name> · idle" /
// "<name> · talking". Once a look is worth sharing, copy it into AUTHOR_PRESETS
// above (the tuner has a copy button that formats the line for you).
export interface SavedPreset {
  id: string;
  name: string;
  state: 'idle' | 'talk';
  params: OrbParams;
}
const LS_SAVED = 'gg-flow-builder-v18:orb-saved';
export function loadSaved(): SavedPreset[] {
  try {
    const s = localStorage.getItem(LS_SAVED);
    if (s) return JSON.parse(s) as SavedPreset[];
  } catch {
    // ignore
  }
  return [];
}
export function saveSavedList(list: SavedPreset[]): void {
  try {
    localStorage.setItem(LS_SAVED, JSON.stringify(list));
  } catch {
    // ignore
  }
}
