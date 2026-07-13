import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { toggleSetItem } from '@/components/onboarding/constants';
import { DayPicker } from '@/components/ui/DayPicker';
import { TimePicker, formatTime12 } from '@/components/ui/TimePicker';
import { BeatPlayer, Bloom, useElementReveal, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';
import { FONT, INK, SUBTLE } from './_beatStyle';
import { ritualWeekdaysForLocale } from './ritualCadence';

// Amber accent, unique to the morning theme.
const AMBER = 'rgb(245, 158, 11)';
const AMBER_LIGHT = 'rgba(245, 158, 11, 0.10)';
const AMBER_MED = 'rgba(245, 158, 11, 0.18)';

// Inline morning card, purposely lighter and warmer than the evening reflection
// card. The default days are the user's local work week, with weekends off.
// Just time + a reminder toggle so the card stays calm and focused.
export function MorningCard({
  days,
  onToggleDay,
  time,
  onTimeChange,
  remind,
  onToggleRemind,
  revealCount,
}: {
  days: Set<number>;
  onToggleDay: (d: number) => void;
  time: string;
  onTimeChange: (t: string) => void;
  remind: boolean;
  onToggleRemind: (v: boolean) => void;
  revealCount?: number;
}) {
  // Days first, then time, then the reminder, each blooming as its clip plays.
  const reveal = useElementReveal(3, revealCount);
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)',
        border: '1.5px solid rgba(245,158,11,0.22)',
        overflow: 'hidden',
        fontFamily: FONT,
      }}
    >
      {/* Warm header strip */}
      <div
        style={{
          background: `linear-gradient(135deg, ${AMBER_MED} 0%, rgba(254,243,199,0.60) 100%)`,
          padding: '18px 20px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: `1px solid ${AMBER_MED}`,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: AMBER_LIGHT,
            border: `1.5px solid rgba(245,158,11,0.28)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon icon="ph:sun-horizon-bold" width={24} height={24} style={{ color: AMBER }} />
        </div>
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: INK,
              lineHeight: 1.2,
            }}
          >
            Morning check-in
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'rgb(120,100,60)',
              marginTop: 2,
              lineHeight: 1.3,
            }}
          >
            Quick state check every morning
          </div>
        </div>
      </div>

      {/* Days row */}
      <Bloom show={reveal > 0}>
        <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
          <DayPicker selectedDays={days} onToggleDay={onToggleDay} />
        </div>
      </Bloom>

      {/* Time row */}
      <Bloom show={reveal > 1}>
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(15,23,42,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon
              icon="ph:clock-afternoon-light"
              width={18}
              height={18}
              style={{ color: SUBTLE, flexShrink: 0 }}
            />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'rgb(51,65,85)' }}>
              Check-in time
            </span>
          </div>
          <TimePicker value={time} onChange={onTimeChange} />
        </div>
      </Bloom>

      {/* Remind me row + hint */}
      <Bloom show={reveal > 2}>
        <div
          style={{
            padding: '14px 20px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon
              icon="ph:bell-simple-light"
              width={18}
              height={18}
              style={{ color: SUBTLE, flexShrink: 0 }}
            />
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'rgb(51,65,85)' /* SUBTLE_DARK */,
                  lineHeight: 1.2,
                }}
              >
                Remind me
              </div>
              <div
                style={{ fontSize: 12.5, fontWeight: 500, color: 'rgb(148,163,184)', marginTop: 1 }}
              >
                {remind ? `Notification at ${formatTime12(time)}` : 'Notifications off'}
              </div>
            </div>
          </div>

          {/* Inline toggle, amber accent to match morning theme */}
          <button
            type="button"
            role="switch"
            aria-checked={remind}
            onClick={() => onToggleRemind(!remind)}
            style={{
              position: 'relative',
              width: 44,
              height: 26,
              borderRadius: 13,
              border: 'none',
              cursor: 'pointer',
              background: remind ? AMBER : 'rgba(203,213,225,0.8)',
              transition: 'background 200ms ease-out',
              flexShrink: 0,
              padding: 0,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 3,
                left: 3,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                transition: 'transform 200ms ease-out',
                transform: remind ? 'translateX(18px)' : 'translateX(0)',
              }}
            />
          </button>
        </div>
      </Bloom>
    </div>
  );
}

function MorningCheckinSetupBeat(props?: Record<string, string>) {
  const flow = useFlowState();
  const [days, setDays] = useState<Set<number>>(() => ritualWeekdaysForLocale(props?.locale));
  const [time, setTime] = useState(props?.defaultTime ?? '08:00');
  const [remind, setRemind] = useState(true);
  const toggleDay = (d: number) => setDays((p) => toggleSetItem(p, d));

  // Lift the chosen morning time to shared flow state so the plan recap and the
  // home tour show the real time the user set, not a placeholder.
  useEffect(() => {
    flow?.setMorningTime(time);
    // react to the time only; flow is read at call time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time]);

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say:
        props?.coachLine ??
        "Part of the coaching process is doing this on your workdays. It gives us two things. First, it's a real quick check-in on how your state is, which is valuable, and people don't usually do it enough. And second, over time it lets us see the connection between your behavior and your state. So when would you like to do this each morning? I recommend 15 minutes after you wake up.",
    },
  ];
  // L5: the picker renders between the two bubbles. The first bubble sets up
  // the pick, the picker appears, then the consistency nudge (bubble 2) lands
  // once the user has the picker in front of them.
  steps.push({
    id: 'card',
    speaker: 'coach',
    render: (
      <MorningCard
        days={days}
        onToggleDay={toggleDay}
        time={time}
        onTimeChange={setTime}
        remind={remind}
        onToggleRemind={setRemind}
      />
    ),
  });
  // Optional second coach bubble (the days recommendation), after the picker.
  if (props?.coachLine2) {
    steps.push({ id: 'ask2', speaker: 'coach', say: props.coachLine2 });
  }

  return <BeatPlayer steps={steps} />;
}

const morningCheckinSetupBeat: BeatDef = {
  type: 'morning-checkin-setup',
  group: 'Onboarding',
  label: 'Morning check-in setup',
  Comp: MorningCheckinSetupBeat,
};

export default morningCheckinSetupBeat;
