import { OrbTuner } from '../orb/OrbTuner';
import type { BeatDef } from '../beatKit';

// Orb section: the live orb + full tuner (idle vs talking settings, both talking
// styles, mic test, and presets). Presets and the two locked looks live in
// ../orb/orbPresets.ts, which is version-controlled so they persist and stay
// collaborative (add your own preset block on your branch).
function OrbTunerBeat() {
  return (
    <div style={{ position: 'relative', width: '100%', minHeight: 760, display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
      <OrbTuner />
    </div>
  );
}

const orbTunerBeat: BeatDef = {
  type: 'orb-tuner',
  group: 'Orb',
  label: 'Orb tuner (live + presets)',
  Comp: OrbTunerBeat,
};

export default orbTunerBeat;
