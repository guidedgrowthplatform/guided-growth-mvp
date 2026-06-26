import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

// The advanced (exp) side of the fork: instead of the beginner cards, the user
// reads their existing habits out loud and the coach organizes them. Tagged
// showOnPath: 'exp' in the default flow, so it only appears when the user picks
// "I already track habits" at the path beat.
function AdvancedCaptureBeat(props?: Record<string, string>) {
  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say:
        props?.coachLine ??
        "Perfect. Read me the habits you already track and I'll get them organized.",
    },
    {
      id: 'show',
      speaker: 'coach',
      render: (
        <div className="flex flex-col gap-3">
          <textarea
            placeholder="Type or say your habits, one per line..."
            rows={6}
            className="w-full resize-none rounded-2xl border border-[rgba(15,23,42,0.10)] bg-white px-4 py-3 text-[14px] leading-[1.5] text-content shadow-card focus:border-primary focus:outline-none"
          />
          <div className="text-[12px] leading-[1.4] text-content-tertiary">
            I'll sort these into categories and set up your schedule.
          </div>
        </div>
      ),
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const advancedCaptureBeat: BeatDef = {
  type: 'advanced-capture',
  group: 'Onboarding',
  label: 'Advanced capture',
  Comp: AdvancedCaptureBeat,
};

export default advancedCaptureBeat;
