import { FONT, PRIMARY, SECTION_LABEL } from './_beatStyle';
import { type BeatDef } from '../beatKit';

// Eyebrow accent: GG blue at 70% opacity, matching the Tailwind text-primary/70 intent.
const PRIMARY_70 = 'rgba(19,91,235,0.7)';

// Beat 1: the splash screen. The brand alone, with the orb resting docked at the
// bottom (the canvas chrome orb). The first thing the user sees. Copy is editable
// from props.
function Splash(props?: Record<string, string>) {
  const heading = props?.heading ?? 'Guided Growth';
  const eyebrow = props?.eyebrow ?? 'Behavioral OS';
  return (
    <div
      style={{ fontFamily: FONT }}
      className="flex flex-col items-center gap-3 text-center"
    >
      <div
        style={{ color: PRIMARY, fontFamily: FONT }}
        className="text-[34px] font-extrabold tracking-tight leading-none"
      >
        {heading}
      </div>
      <span
        style={{
          ...SECTION_LABEL,
          color: PRIMARY_70,
          letterSpacing: '0.16em',
        }}
      >
        {eyebrow}
      </span>
    </div>
  );
}

const splashBeat: BeatDef = {
  type: 'splash',
  group: 'Onboarding',
  label: 'Splash',
  Comp: Splash,
};

export default splashBeat;
