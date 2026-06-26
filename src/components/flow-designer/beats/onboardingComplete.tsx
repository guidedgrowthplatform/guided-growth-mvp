import { Button } from '@/components/ui/Button';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

// Closing beat: the coach wraps up and hands off into the app. First version is
// a line plus a button; the actual navigate-to-home is engine side.
function IntoAppBeat(props?: Record<string, string>) {
  const steps: BeatStep[] = [
    {
      id: 'wrap',
      speaker: 'coach',
      say: props?.coachLine ?? "You're all set. Let's get started.",
    },
    {
      id: 'go',
      speaker: 'coach',
      render: (
        <div className="flex w-full flex-col items-center">
          <Button variant="primary" size="auth" fullWidth>
            {props?.buttonLabel ?? 'Enter Guided Growth'}
          </Button>
        </div>
      ),
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const intoAppBeat: BeatDef = {
  type: 'into-app',
  group: 'Onboarding',
  label: 'Into the app',
  Comp: IntoAppBeat,
};

export default intoAppBeat;
