import { IconChatVoice, IconMicMuted } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { DualButton } from '@/components/ui/DualButton';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

const ORB = 150;
const FONT = 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

// The mic-permission ask. The orb's mic (right) half pulses, the grey half and
// its icon scaling in and out together as one group. Below it, the Allow button
// and a quiet skip. All copy is editable from props (sidebar + flow).
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
    <div className="flex flex-col items-center gap-6">
      {/* The orb. Left half blue (coach voice), right half grey (mic off) and
          pulsing as a group with its icon. No rings. */}
      <div style={{ position: 'relative', width: ORB, height: ORB }}>
        <DualButton
          size={ORB}
          leftActive
          rightActive={false}
          leftIcon={<IconChatVoice size={38} />}
          rightIcon={<IconMicMuted size={38} />}
          leftAriaLabel="Coach voice"
          rightAriaLabel="Microphone"
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 70.5,
            height: ORB,
            background: '#94a3b8',
            borderRadius: '7.4px 75px 75px 7.4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            transformOrigin: '0% 50%',
            animation: 'ggMicPulse 1.9s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        >
          <IconMicMuted size={38} />
        </div>
      </div>

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

      <style>{`@keyframes ggMicPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}`}</style>
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
