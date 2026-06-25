import { type BeatDef } from '../beatKit';

// Beat 1: the splash screen. The brand alone, with the orb resting docked at the
// bottom (the canvas chrome orb). The first thing the user sees. Tap to continue
// to Get Started. Copy is editable from props.
function Splash(props?: Record<string, string>) {
  const heading = props?.heading ?? 'Guided Growth';
  const eyebrow = props?.eyebrow ?? 'Behavioral OS';
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="text-[34px] font-extrabold tracking-tight text-primary">{heading}</div>
      <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-primary/70">
        {eyebrow}
      </div>
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
