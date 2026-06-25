import { Button } from '@/components/ui/Button';
import { type BeatDef } from '../beatKit';

// The Get Started beat. Comes right after the splash: the brand line and a
// single primary button that begins onboarding, with a quiet log-in link for
// returning users. All copy is editable from props (sidebar + flow).
function GetStarted(props?: Record<string, string>) {
  const heading = props?.heading ?? 'Guided Growth';
  const eyebrow = props?.eyebrow ?? 'Behavioral OS';
  const buttonLabel = props?.buttonLabel ?? 'Get started';
  const loginLabel = props?.loginLabel ?? 'I already have an account';
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div>
        <div className="text-[30px] font-extrabold tracking-tight text-primary">{heading}</div>
        <div className="mt-2 text-[12px] font-bold uppercase tracking-[0.16em] text-primary/70">
          {eyebrow}
        </div>
      </div>
      <div className="flex w-full flex-col items-center gap-3">
        <Button variant="primary" size="auth" fullWidth>
          {buttonLabel}
        </Button>
        <button type="button" className="text-[14px] font-semibold text-content-secondary">
          {loginLabel}
        </button>
      </div>
    </div>
  );
}

const getStartedBeat: BeatDef = {
  type: 'get-started',
  group: 'Onboarding',
  label: 'Get Started',
  Comp: GetStarted,
};

export default getStartedBeat;
