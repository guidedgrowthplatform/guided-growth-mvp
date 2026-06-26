import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/Button';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';

const FONT = 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const BLUE = 'rgb(19, 91, 235)';

// One row in the plan recap card.
function PlanRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(19,91,235,0.10)',
        }}
      >
        <Icon icon={icon} width={18} height={18} style={{ color: BLUE }} />
      </div>
      <span
        style={{
          fontFamily: FONT,
          fontSize: 15,
          fontWeight: 600,
          color: 'rgb(15,23,42)',
          lineHeight: 1.3,
        }}
      >
        {text}
      </span>
    </div>
  );
}

// Divider between rows.
function RowDivider() {
  return (
    <div
      style={{
        height: 1,
        background: 'rgba(15,23,42,0.06)',
        margin: '0 0',
      }}
    />
  );
}

function IntoAppBeat(props?: Record<string, string>) {
  const flow = useFlowState();

  // Build plan rows from live flow state when in Play, or fall back to
  // sample/placeholder values when on the static canvas (flow is null there).
  const habitCount = flow?.habits?.length ?? 3;
  const habitLabel =
    habitCount === 1 ? '1 habit set' : `${habitCount} habit${habitCount === 0 ? 's' : 's'} set`;

  // Sample schedule values — the real engine fills these from the schedule beats.
  const morningTime = props?.morningTime ?? '8:00 AM';
  const eveningTime = props?.eveningTime ?? '9:30 PM';

  const rows: Array<{ icon: string; text: string }> = [
    { icon: 'mdi:format-list-checks', text: props?.habitRow ?? habitLabel },
    { icon: 'mdi:weather-sunny', text: `Morning check-in at ${morningTime}` },
    { icon: 'mdi:moon-waning-crescent', text: `Evening reflection at ${eveningTime}` },
  ];

  const steps: BeatStep[] = [
    {
      id: 'wrap',
      speaker: 'coach',
      say: props?.coachLine ?? "You're all set. Here's your plan.",
    },
    {
      id: 'recap',
      speaker: 'coach',
      render: (
        <div
          style={{
            background: '#fff',
            borderRadius: 20,
            boxShadow: '0 4px 20px -8px rgba(15,23,42,0.14)',
            padding: '6px 18px 6px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {rows.map((row, i) => (
            <div key={row.icon}>
              <PlanRow icon={row.icon} text={row.text} />
              {i < rows.length - 1 && <RowDivider />}
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'go',
      speaker: 'coach',
      render: (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            marginTop: 4,
          }}
        >
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
