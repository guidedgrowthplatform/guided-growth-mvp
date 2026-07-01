// Orb presets + the two locked looks (idle vs talking) for the Orb section of
// the flow builder. This file is version-controlled, so presets persist and are
// collaborative: add your own author block on your branch and open an MR. Nobody
// has to touch each other's block, so there are no merge conflicts.

export interface OrbParams {
  // Orb (the glass button)
  glass: number; // translucency 0..100
  blur: number; // frost blur 0..100
  hi: number; // highlight sheen 0..100
  rim: number; // ring 0..100
  body: number; // body tone 0..100 (0 light .. 100 dark)
  // Inner light (the Siri blob)
  glow: number; // 50..180
  bright: number; // 60..160
  speed: number; // 10..100
  grad: number; // gradient depth 0..100
  core: number; // core size 20..100
  spread: number; // particle spread 12..60
  pglow: number; // particle glow 0..100
  rand: number; // randomness 0..100
  pulse: number; // talking pulse 0..100
}

export interface OrbStates {
  idle: OrbParams;
  talk: OrbParams;
}

// The current locked look (Yair's "Start"). Idle is the resting two-half orb,
// talk is the livelier setting used when a side is speaking.
export const DEFAULT_PARAMS: OrbStates = {
  idle: { glass: 35, blur: 12, hi: 0, rim: 0, body: 34, glow: 111, bright: 116, speed: 15, grad: 0, core: 59, spread: 41, pglow: 71, rand: 54, pulse: 50 },
  talk: { glass: 35, blur: 12, hi: 0, rim: 0, body: 34, glow: 125, bright: 122, speed: 40, grad: 0, core: 66, spread: 50, pglow: 82, rand: 66, pulse: 55 },
};

// Named quick-fill presets, grouped by author. A preset is a partial set of
// params applied to whichever state (idle or talking) is currently selected.
// To add your own: add a block keyed by your name. Example at the bottom.
export const AUTHOR_PRESETS: Record<string, Record<string, Partial<OrbParams>>> = {
  Yair: {
    Start: { glass: 35, blur: 12, hi: 0, rim: 0, body: 34, glow: 111, bright: 116, speed: 15, grad: 0, core: 59, spread: 41, pglow: 71, rand: 54, pulse: 50 },
    Calm: { glass: 55, glow: 110, bright: 96, speed: 26, grad: 66, rim: 56, body: 34, core: 82, spread: 22, pglow: 42, rand: 18 },
    Recommended: { glass: 45, glow: 120, bright: 100, speed: 45, grad: 70, rim: 55, body: 38, core: 72, spread: 30, pglow: 55, rand: 40 },
    Nebula: { glass: 30, glow: 130, bright: 118, speed: 56, grad: 82, rim: 46, body: 50, core: 58, spread: 52, pglow: 70, rand: 82 },
    Sparkle: { glass: 38, glow: 125, bright: 126, speed: 62, grad: 78, rim: 50, body: 44, core: 46, spread: 40, pglow: 88, rand: 70 },
    Minimal: { glass: 66, glow: 96, bright: 82, speed: 22, grad: 50, rim: 60, body: 28, core: 70, spread: 20, pglow: 34, rand: 16 },
  },
  // Add your own presets on your branch, for example:
  // Timothy: {
  //   'Glass v1': { glass: 60, blur: 24, hi: 55, rim: 40, glow: 118, bright: 108 },
  // },
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
    if (s) return JSON.parse(s) as OrbStates;
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

// --- Pulse (the expand + breathe behaviour while talking) --------------------
// Broken out as its own thing so it can be tuned separately from the idle/talking
// looks. "size" is how big the orb gets in general while talking; "amt" is the
// extra breathing pulse layered on top; "speed" is how fast it breathes.
export interface PulseParams {
  size: number; // baseline expansion when talking (0..40)
  amt: number; // extra breathing amplitude on top (0..100)
  speed: number; // breathing rate (0..100)
}
export const DEFAULT_PULSE: PulseParams = { size: 8, amt: 60, speed: 50 };
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
