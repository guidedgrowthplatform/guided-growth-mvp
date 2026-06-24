import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

// Slot for the mic-permission beat (the orb expands big to ask for the mic,
// then retracts). The animated version is being built in another session; when
// it lands, swap these placeholder steps for the real animation. The slot is
// here so it has its place in the flow now.
function MicPermissionBeat(props?: Record<string, string>) {
  const steps: BeatStep[] = [
    { id: 'ask', speaker: 'coach', say: props?.ask ?? 'Can I turn on your mic so we can talk out loud?' },
    { id: 'note', speaker: 'coach', say: props?.note ?? 'Tap the orb to allow it.' },
  ];
  return <BeatPlayer steps={steps} />;
}

const micPermissionBeat: BeatDef = {
  type: 'mic-permission',
  group: 'Onboarding',
  label: 'Mic permission',
  Comp: MicPermissionBeat,
};

export default micPermissionBeat;
