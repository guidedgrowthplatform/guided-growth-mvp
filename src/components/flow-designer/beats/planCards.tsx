import { Icon } from '@iconify/react';
import { formatTime12 } from '@/components/ui/TimePicker';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState, type HabitScheduleCfg } from '../flowStateCtx';
import { FONT, PRIMARY, INK, CARD, SPACE } from './_beatStyle';

// A habit with its schedule details. When coming from flow state we only have
// the habit name, so we generate plausible time + frequency defaults. Sample
// data on the canvas makes the card feel real.
interface HabitEntry {
  name: string;
  time: string;
  frequency: string;
  icon: string;
}

// Deterministic defaults so the same habit always gets the same time slot on
// the canvas. Cycles through a small set of morning / afternoon slots.
const TIME_DEFAULTS = ['7:00 AM', '8:00 AM', '12:00 PM', '6:00 PM', '9:00 PM'];
const FREQ_DEFAULT = 'Every day';

// Turn the picked days into the same cadence label the schedule card and the
// home tour use, so the recap reads consistently with them.
function frequencyLabel(days: number[]): string {
  const s = new Set(days);
  if (s.size >= 7) return 'Every day';
  if (s.size === 5 && [1, 2, 3, 4, 5].every((d) => s.has(d))) return 'Weekdays';
  if (s.size === 2 && s.has(0) && s.has(6)) return 'Weekends';
  return `${s.size}x / week`;
}

// Build a confirm-card entry from the habit name plus the real schedule the user
// set on the schedule card (lifted to flow state). Falls back to deterministic
// defaults only when there is no config (e.g. the static canvas).
function habitToEntry(name: string, idx: number, cfg?: HabitScheduleCfg): HabitEntry {
  return {
    name,
    time: cfg ? formatTime12(cfg.time) : TIME_DEFAULTS[idx % TIME_DEFAULTS.length],
    frequency: cfg ? frequencyLabel(cfg.days) : FREQ_DEFAULT,
    icon: 'mdi:checkbox-marked-circle-outline',
  };
}

// Sample habits shown when no flow state is present (canvas / static mode).
const SAMPLE_HABITS: HabitEntry[] = [
  { name: 'Morning walk', time: '7:30 AM', frequency: 'Every day', icon: 'mdi:walk' },
  { name: 'No screens after 10 PM', time: '10:00 PM', frequency: 'Every day', icon: 'mdi:cellphone-off' },
  { name: 'Evening journal', time: '9:00 PM', frequency: 'Weekdays', icon: 'mdi:notebook-outline' },
];

// One habit card: name (large), then time + frequency chips below.
function HabitConfirmCard({ habit }: { habit: HabitEntry }) {
  return (
    <div
      style={{
        ...CARD,
        display: 'flex',
        alignItems: 'flex-start',
        gap: SPACE.lg,
        padding: `${SPACE.lg}px 18px`,
      }}
    >
      {/* Icon tile */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(19,91,235,0.10)',
        }}
      >
        <Icon icon={habit.icon} width={22} height={22} style={{ color: PRIMARY }} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 15,
            fontWeight: 700,
            color: INK,
            lineHeight: 1.3,
            marginBottom: SPACE.sm,
          }}
        >
          {habit.name}
        </div>

        {/* Time + frequency pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Chip icon="mdi:clock-outline" label={habit.time} />
          <Chip icon="mdi:calendar-repeat" label={habit.frequency} />
        </div>
      </div>

      {/* Checkmark */}
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: PRIMARY,
          marginTop: 1,
        }}
      >
        <Icon icon="mdi:check" width={14} height={14} style={{ color: '#fff' }} />
      </div>
    </div>
  );
}

// Small inline chip: icon + label, light blue tint.
function Chip({ icon, label }: { icon: string; label: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'rgba(19,91,235,0.09)',
        borderRadius: 8,
        padding: '3px 9px 3px 6px',
      }}
    >
      <Icon icon={icon} width={13} height={13} style={{ color: PRIMARY, flexShrink: 0 }} />
      <span
        style={{
          fontFamily: FONT,
          fontSize: 12,
          fontWeight: 700,
          color: PRIMARY,
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function PlanCardsBeat(props?: Record<string, string>) {
  // In Play, use the habits the user actually picked upstream. On the canvas,
  // fall back to sample data so the tile always looks complete.
  const flow = useFlowState();
  const habits: HabitEntry[] = flow?.habits.length
    ? flow.habits.map((name, idx) => habitToEntry(name, idx, flow.habitConfigs[name]))
    : SAMPLE_HABITS;

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say: props?.coachLine ?? "Here's your plan. Take a look and we'll make it yours.",
    },
    {
      id: 'cards',
      speaker: 'coach',
      render: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
          {habits.map((h) => (
            <HabitConfirmCard key={h.name} habit={h} />
          ))}
        </div>
      ),
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const planCardsBeat: BeatDef = {
  type: 'plan-cards',
  group: 'Onboarding',
  label: 'Plan summary',
  Comp: PlanCardsBeat,
};

export default planCardsBeat;
