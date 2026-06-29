import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

// Beat: Why Intro
// A coach-only framing beat shown once, placed before the morning check-in beat.
// No interactive card, no user reply. The coach frames the first habit and explains
// that checking in is simple and valuable. All copy is editable from props.
function WhyIntroBeat(props?: Record<string, string>) {
  const steps: BeatStep[] = [
    {
      id: 'frame',
      speaker: 'coach',
      say:
        props?.coachLine ??
        "This is your first habit. Checking in takes about thirty seconds, and over time it tells you a lot about yourself.",
    },
    {
      id: 'reassure',
      speaker: 'coach',
      say:
        props?.coachLineTwo ??
        "No pressure. Just show up, and I'll handle the rest.",
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const whyIntroBeat: BeatDef = {
  type: 'why-intro',
  group: 'Onboarding',
  label: 'Why intro',
  Comp: WhyIntroBeat,
};

export default whyIntroBeat;
