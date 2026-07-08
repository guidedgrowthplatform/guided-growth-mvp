// Canonical orb config: the single source of truth for the Guided Growth orb.
// The real app orb AND the flow builder both read from here. The flow builder is
// where you DESIGN these numbers; a look committed into DEFAULT_PARAMS /
// DEFAULT_PULSE becomes the orb the app ships. This file is app-owned (not under
// the flow-designer tool) so the app leads and the builder consumes the same orb.

interface OrbParams {
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
  // Extra layers (additive, default 0 = off, so existing looks are unchanged)
  aura: number; // breathing outer halo 0..100
  iris: number; // iridescent rim sheen 0..100
  depth: number; // glass 3D depth (inner shadow + top highlight) 0..100
}

export interface OrbStates {
  idle: OrbParams;
  talk: OrbParams;
}

// Pulse (the expand + breathe behaviour while talking), split into layers so each
// can move on its own (disc vs outer membrane vs inner light).
export interface PulseParams {
  size: number; // baseline expansion when talking (0..40)
  amt: number; // extra breathing amplitude on top (0..100)
  speed: number; // breathing rate (0..100)
  orbAmt: number; // how much the orb DISC expands/contracts (0 = disc stays stable) 0..100
  mem: number; // outer membrane breathe amount 0..100
  memSpeed: number; // outer membrane breathe tempo (independent of the disc) 0..100
  // Per-part voice reactivity: how hard each part grows/brightens with the voice. Set
  // each independently to choreograph the orb (0 = that part ignores the voice). 0..100.
  reactLight: number; // the inner light (the moving glow blobs)
  reactDisc: number; // the disc (the whole circle scale)
  reactAura: number; // the outer aura / membrane
  reactCore: number; // the bright center core
}

// The current locked look (Yair's "Start"). Idle is the resting two-half orb; talk
// is the livelier setting used when a side is speaking. Change these to reship the
// app orb.
export const DEFAULT_PARAMS: OrbStates = {
  // Idle = Timothy's "Aurora Bloom" (the look Yair set): membrane aura + iridescent
  // rim + glass depth on the resting two-half orb.
  idle: {
    glass: 34,
    blur: 12,
    hi: 42,
    rim: 55,
    body: 44,
    glow: 150,
    bright: 126,
    speed: 52,
    grad: 82,
    core: 42,
    spread: 60,
    pglow: 86,
    rand: 72,
    pulse: 58,
    aura: 78,
    iris: 66,
    depth: 32,
  },
  // Talking (coach + user full circle) = Yair's saved "Yair Talking Jul 5" look
  // (2026-07-05): softer glow, high randomness + particle glow, low aura so the core
  // reads through, especially the gold when the user speaks.
  talk: {
    glass: 38,
    blur: 14,
    hi: 50,
    rim: 70,
    body: 42,
    glow: 80,
    bright: 96,
    speed: 46,
    grad: 74,
    core: 45,
    spread: 60,
    pglow: 96,
    rand: 100,
    pulse: 55,
    aura: 23,
    iris: 67,
    depth: 39,
  },
};

// Committed motion = Yair's "Balanced" preset (2026-07-05).
export const DEFAULT_PULSE: PulseParams = {
  size: 8,
  amt: 46,
  speed: 40,
  orbAmt: 85,
  mem: 58,
  memSpeed: 32,
  reactLight: 52,
  reactDisc: 48,
  reactAura: 50,
  reactCore: 44,
};

// Beat 3 (the big coach-greeting orb) runs a CALMER motion than the docked default:
// at full size the same reactivity reads as aggressive, so the pulse + reactivity are
// dialed down. Passed to beat 3 only (via orbSpeaking); nothing else changes.
export const BEAT3_PULSE: PulseParams = {
  size: 6,
  amt: 30,
  speed: 32,
  orbAmt: 50,
  mem: 50,
  memSpeed: 28,
  reactLight: 30,
  reactDisc: 22,
  reactAura: 26,
  reactCore: 28,
};
