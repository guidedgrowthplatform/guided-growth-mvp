// Canonical orb config: the single source of truth for the Guided Growth orb.
// The real app orb AND the flow builder both read from here. The flow builder is
// where you DESIGN these numbers; a look committed into DEFAULT_PARAMS /
// DEFAULT_PULSE becomes the orb the app ships. This file is app-owned (not under
// the flow-designer tool) so the app leads and the builder consumes the same orb.

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
}

// The current locked look (Yair's "Start"). Idle is the resting two-half orb; talk
// is the livelier setting used when a side is speaking. Change these to reship the
// app orb.
export const DEFAULT_PARAMS: OrbStates = {
  idle: {
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
    aura: 0,
    iris: 0,
    depth: 0,
  },
  talk: {
    glass: 35,
    blur: 12,
    hi: 0,
    rim: 0,
    body: 34,
    glow: 125,
    bright: 122,
    speed: 40,
    grad: 0,
    core: 66,
    spread: 50,
    pglow: 82,
    rand: 66,
    pulse: 55,
    aura: 0,
    iris: 0,
    depth: 0,
  },
};

export const DEFAULT_PULSE: PulseParams = {
  size: 8,
  amt: 60,
  speed: 50,
  orbAmt: 100,
  mem: 60,
  memSpeed: 35,
};
