import type { BeatDef } from '../beatKit';

// Auto-collects every beat file in this folder (skipping _-prefixed templates).
// Add a beat by dropping a new file here that default-exports a BeatDef. No edit
// to this file or to FlowBuilder is needed; the registry merges these in.
const mods = import.meta.glob('./[!_]*.tsx', { eager: true });

export const BEAT_DEFS: BeatDef[] = Object.values(mods)
  .map((m) => (m as { default?: BeatDef }).default)
  .filter((d): d is BeatDef => Boolean(d && d.type && d.Comp));
