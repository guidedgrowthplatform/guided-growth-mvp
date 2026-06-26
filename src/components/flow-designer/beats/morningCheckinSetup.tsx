import { useState } from 'react';
import { Icon } from '@iconify/react';
import { TimePicker, formatTime12 } from '@/components/ui/TimePicker';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

const FONT = 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const BLUE = 'rgb(19, 91, 235)';
const AMBER = 'rgb(245, 158, 11)';
const AMBER_LIGHT = 'rgba(245, 158, 11, 0.10)';
const AMBER_MED = 'rgba(245, 158, 11, 0.18)';

// Inline morning card — purposely lighter and warmer than the evening reflection
// card. No day picker, no schedule selector: morning check-ins are every day by
// design. Just time + a reminder toggle so the card stays calm and focused.
function MorningCard({
  time,
  onTimeChange,
  remind,
  onToggleRemind,
}: {
  time: string;
  onTimeChange: (t: string) => void;
  remind: boolean;
  onToggleRemind: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 4px 20px -8px rgba(15,23,42,0.12)',
        border: '1.5px solid rgba(245,158,11,0.20)',
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
              color: 'rgb(15,23,42)',
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
            Quick mood check every morning
          </div>
        </div>
      </div>

      {/* Time row */}
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
            style={{ color: 'rgb(100,116,139)', flexShrink: 0 }}
          />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'rgb(51,65,85)' }}>Check-in time</span>
        </div>
        <TimePicker value={time} onChange={onTimeChange} />
      </div>

      {/* Remind me row */}
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
            style={{ color: 'rgb(100,116,139)', flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'rgb(51,65,85)', lineHeight: 1.2 }}>
              Remind me
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: 'rgb(148,163,184)', marginTop: 1 }}>
              {remind
                ? `Notification at ${formatTime12(time)}`
                : 'Notifications off'}
            </div>
          </div>
        </div>

        {/* Inline toggle — amber accent to match morning theme */}
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

      {/* Subtle footer hint when reminder is on */}
      {remind && (
        <div
          style={{
            margin: '0 20px 14px',
            padding: '9px 12px',
            borderRadius: 10,
            background: AMBER_LIGHT,
            border: `1px solid rgba(245,158,11,0.18)`,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <Icon icon="ph:sparkle-bold" width={14} height={14} style={{ color: AMBER, flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgb(120,100,60)', lineHeight: 1.35 }}>
            I'll nudge you each morning to check in
          </span>
        </div>
      )}
    </div>
  );
}

function MorningCheckinSetupBeat(props?: Record<string, string>) {
  const [time, setTime] = useState(props?.defaultTime ?? '08:00');
  const [remind, setRemind] = useState(true);

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say:
        props?.coachLine ??
        "When do you want your morning check-in? I'll nudge you then.",
    },
    {
      id: 'card',
      speaker: 'coach',
      render: (
        <MorningCard
          time={time}
          onTimeChange={setTime}
          remind={remind}
          onToggleRemind={setRemind}
        />
      ),
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const morningCheckinSetupBeat: BeatDef = {
  type: 'morning-checkin-setup',
  group: 'Onboarding',
  label: 'Morning check-in setup',
  Comp: MorningCheckinSetupBeat,
};

export default morningCheckinSetupBeat;
