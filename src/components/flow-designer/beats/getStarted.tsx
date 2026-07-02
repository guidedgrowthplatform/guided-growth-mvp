import { FONT, PRIMARY, SECTION_LABEL, SUBTLE, SPACE } from './_beatStyle';
import { Button } from '@/components/ui/Button';
import { type BeatDef } from '../beatKit';
import { startFlow } from './_startGate';

// Eyebrow accent: GG blue at 70% opacity, matching the Tailwind text-primary/70 intent.
const PRIMARY_70 = 'rgba(19,91,235,0.7)';

// The Get Started beat. Comes right after the splash: the brand line and a
// single primary button that begins onboarding, with a quiet log-in link for
// returning users. All copy is editable from props (sidebar + flow).
function GetStarted(props?: Record<string, string>) {
  const heading = props?.heading ?? 'Guided Growth';
  const eyebrow = props?.eyebrow ?? 'Behavioral OS';
  const buttonLabel = props?.buttonLabel ?? 'Get started';
  const loginLabel = props?.loginLabel ?? 'I already have an account';
  return (
    <div
      style={{ fontFamily: FONT, gap: SPACE.xl * 1.5 }}
      className="flex flex-col items-center text-center"
    >
      {/* Brand block */}
      <div className="flex flex-col items-center" style={{ gap: SPACE.sm }}>
        <div
          style={{ color: PRIMARY, fontFamily: FONT }}
          className="text-[30px] font-extrabold tracking-tight leading-none"
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

      {/* CTA cluster */}
      <div className="flex w-full flex-col items-center" style={{ gap: SPACE.md }}>
        <Button variant="primary" size="auth" fullWidth onClick={startFlow}>
          {buttonLabel}
        </Button>
        <button
          type="button"
          style={{ fontFamily: FONT, color: SUBTLE, fontSize: 14, fontWeight: 600 }}
        >
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
