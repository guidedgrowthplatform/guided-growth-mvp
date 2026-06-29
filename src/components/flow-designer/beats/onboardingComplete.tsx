import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/Button';
import { formatTime12 } from '@/components/ui/TimePicker';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';
import { FONT, PRIMARY, INK, SUBTLE, BORDER_LIGHT, CARD, SPACE } from './_beatStyle';

// Sample habits shown on the canvas (no live flow state in static mode).
const SAMPLE_HABITS = ['Morning walk', 'No screens after 10 PM'];

// One row in the schedule summary (morning or evening check-in time).
function ScheduleRow({
  icon,
  label,
  time,
}: {
  icon: string;
  label: string;
  time: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACE.sm,
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: FONT,
          fontSize: 13,
          fontWeight: 700,
          color: INK,
        }}
      >
        <Icon icon={icon} width={15} height={15} style={{ color: PRIMARY, flexShrink: 0 }} />
        {label}
      </span>
      <span
        style={{
          fontFamily: FONT,
          fontSize: 13,
          fontWeight: 600,
          color: SUBTLE,
        }}
      >
        {time}
      </span>
    </div>
  );
}

// One habit line under the divider. Keeps the full plan card compact.
function HabitLine({ name }: { name: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.sm,
        padding: '5px 0',
      }}
    >
      <Icon
        icon="mdi:checkbox-marked-circle-outline"
        width={15}
        height={15}
        style={{ color: PRIMARY, flexShrink: 0 }}
      />
      <span
        style={{
          fontFamily: FONT,
          fontSize: 13,
          fontWeight: 600,
          color: INK,
          lineHeight: 1.3,
        }}
      >
        {name}
      </span>
    </div>
  );
}

function FullPlanBeat(props?: Record<string, string>) {
  const flow = useFlowState();

  // Times: prefer real values lifted from the morning and evening beats,
  // fall back to props (useful when a designer pins a custom preview),
  // then default placeholders so the static canvas tile always reads complete.
  const morningTime = flow?.morningTime
    ? formatTime12(flow.morningTime)
    : (props?.morningTime ?? '8:00 AM');

  const eveningTime = flow?.eveningTime
    ? formatTime12(flow.eveningTime)
    : (props?.eveningTime ?? '9:30 PM');

  // Habits: real selections when in Play, sample when on the static canvas.
  const habits: string[] =
    flow && flow.habits.length > 0 ? flow.habits : SAMPLE_HABITS;

  const planCard = (
    <div
      style={{
        ...CARD,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.md,
      }}
    >
      {/* Section eyebrow */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 2,
        }}
      >
        <div
          style={{
            width: 4,
            height: 18,
            borderRadius: 2,
            background: PRIMARY,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: FONT,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.05em',
            textTransform: 'uppercase' as const,
            color: PRIMARY,
          }}
        >
          Your plan
        </span>
      </div>

      {/* Morning check-in row */}
      <ScheduleRow
        icon="mdi:weather-sunny"
        label="Morning check-in"
        time={morningTime}
      />

      {/* Evening reflection row */}
      <ScheduleRow
        icon="mdi:moon-waning-crescent"
        label="Evening reflection"
        time={eveningTime}
      />

      {/* Divider + habit list */}
      <div style={{ borderTop: `1px solid ${BORDER_LIGHT}`, paddingTop: SPACE.md }}>
        {habits.map((h) => (
          <HabitLine key={h} name={h} />
        ))}
      </div>
    </div>
  );

  const approveButton = (
    <div style={{ width: '100%', marginTop: 4 }}>
      <Button variant="primary" size="auth" fullWidth>
        {props?.buttonLabel ?? 'Approve and start'}
      </Button>
    </div>
  );

  const steps: BeatStep[] = [
    {
      id: 'coach-intro',
      speaker: 'coach',
      say: props?.coachLine ?? "Here's your plan. Take a look.",
    },
    {
      id: 'plan-card',
      speaker: 'coach',
      render: planCard,
    },
    {
      id: 'approve',
      speaker: 'coach',
      render: approveButton,
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const fullPlanBeat: BeatDef = {
  type: 'into-app',
  group: 'Onboarding',
  label: 'Full plan confirm',
  Comp: FullPlanBeat,
};

export default fullPlanBeat;
