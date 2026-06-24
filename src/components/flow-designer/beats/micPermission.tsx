import { Button } from '@/components/ui/Button';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

const FONT = 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

// The mic-permission ask. The orb is the canvas's shared orb: on this beat its
// mic (right) half pulses (see BeatOrb in the canvas). This beat renders the
// prompt + the Allow button above it. All copy is editable from props.
function MicAsk({
  heading = 'Allow your microphone',
  sub = 'So you can talk with your coach out loud.',
  allowLabel = 'Allow microphone',
  skipLabel = 'Not now',
}: {
  heading?: string;
  sub?: string;
  allowLabel?: string;
  skipLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-7">
      <div style={{ textAlign: 'center', padding: '0 12px' }}>
        <h1
          style={{
            fontFamily: FONT,
            fontSize: 'clamp(22px, 6vw, 28px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'rgb(19, 91, 235)',
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          {heading}
        </h1>
        <p
          style={{
            fontFamily: FONT,
            fontSize: 15,
            fontWeight: 500,
            color: 'rgb(100,116,139)',
            margin: '10px auto 0',
            maxWidth: 300,
            lineHeight: 1.4,
          }}
        >
          {sub}
        </p>
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Button variant="primary" size="auth" fullWidth>
          {allowLabel}
        </Button>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 600,
            color: 'rgb(100,116,139)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {skipLabel}
        </span>
      </div>
    </div>
  );
}

function MicPermissionBeat(props?: Record<string, string>) {
  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      render: (
        <MicAsk
          heading={props?.heading}
          sub={props?.sub}
          allowLabel={props?.allowLabel}
          skipLabel={props?.skipLabel}
        />
      ),
    },
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
