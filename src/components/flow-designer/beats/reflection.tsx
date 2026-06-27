import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

// Evening reflection as ONE beat: a transition, then the three questions
// (proud, forgive, grateful) walked as steps inside the beat. The steps can
// change a little without splitting it into separate beats. Each spoken line's
// audio comes from its own Voice Scripts stage (the beat carries all of them).
function ReflectionBeat(props?: Record<string, string>) {
  const steps: BeatStep[] = [
    {
      id: 'transition',
      speaker: 'coach',
      say: props?.transition ?? "Good. Now let's take a moment to reflect on the day itself.",
    },
    { id: 'proud-q', speaker: 'coach', say: props?.proud ?? 'What are you proud of today?' },
    { id: 'proud-a', speaker: 'user', say: props?.proudAnswer ?? 'I showed up even though I was tired.' },
    {
      id: 'forgive-q',
      speaker: 'coach',
      say: props?.forgive ?? 'What do you forgive yourself for today?',
    },
    { id: 'forgive-a', speaker: 'user', say: props?.forgiveAnswer ?? 'Skipping my afternoon walk.' },
    { id: 'grateful-q', speaker: 'coach', say: props?.grateful ?? 'What are you grateful for today?' },
    { id: 'grateful-a', speaker: 'user', say: props?.gratefulAnswer ?? 'A good talk with my brother.' },
  ];
  return <BeatPlayer steps={steps} />;
}

const reflectionBeat: BeatDef = {
  type: 'reflection',
  group: 'Check-in',
  label: 'Evening reflection (proud / forgive / grateful)',
  Comp: ReflectionBeat,
};

export default reflectionBeat;
