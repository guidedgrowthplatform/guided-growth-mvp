import { AUTHOR_PRESETS, DEFAULT_PARAMS, MOTION_PRESETS, type OrbStates } from './orbPresets';

// The one shared orb look, used by BOTH the Play phone and the annotated per-beat
// phones so the orb reads identically everywhere it appears. The Aurora Bloom
// preset (breathing aura + iridescent rim) merged onto the base so every field is
// set, used for both idle and talking; motion is the calm-membrane breathe.
const ORB_LOOK = { ...DEFAULT_PARAMS.idle, ...AUTHOR_PRESETS.Timothy['Aurora Bloom'] };
export const ORB_PARAMS: OrbStates = { idle: ORB_LOOK, talk: ORB_LOOK };
export const ORB_PULSE = MOTION_PRESETS['Calm membrane'];
