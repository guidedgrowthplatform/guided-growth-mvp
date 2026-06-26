import { useState } from 'react';
import { Icon } from '@iconify/react';
import { type ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { Toggle } from '@/components/ui/Toggle';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';

const FONT = 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const BLUE = 'rgb(19, 91, 235)';

const FREQ_OPTIONS: ScheduleOption[] = ['Every day', 'Weekday', 'Weekend'];

const DEFAULT_HABITS = ['Morning walk', 'Read 10 pages', 'No screens after 10'];

// Default times spread out through the day so the sample list looks plausible.
const DEFAULT_TIMES: Record<string, string> = {
  'Morning walk': '07:00',
  'Read 10 pages': '21:00',
  'No screens after 10': '22:00',
};

function defaultTime(habit: string) {
  return DEFAULT_TIMES[habit] ?? '08:00';
}

// A small inline frequency picker: three pill chips in a row.
function FreqPicker({
  value,
  onChange,
}: {
  value: ScheduleOption;
  onChange: (v: ScheduleOption) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {FREQ_OPTIONS.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 700,
              padding: '5px 12px',
              borderRadius: 999,
              border: active ? `1.5px solid ${BLUE}` : '1.5px solid rgba(15,23,42,0.10)',
              background: active ? 'rgba(19,91,235,0.08)' : 'rgba(15,23,42,0.04)',
              color: active ? BLUE : 'rgb(100,116,139)',
              cursor: 'pointer',
              transition: 'background 140ms ease-out, color 140ms ease-out, border-color 140ms ease-out',
              whiteSpace: 'nowrap',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// Editable time pill — clicking opens a native <input type="time"> inline.
function TimePill({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Display HH:MM as h:MM AM/PM
  function fmt(raw: string) {
    const [hStr, mStr] = raw.split(':');
    const h = parseInt(hStr, 10);
    const m = mStr ?? '00';
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m} ${ampm}`;
  }

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: BLUE,
        color: '#fff',
        borderRadius: 999,
        padding: '5px 14px',
        fontFamily: FONT,
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      <Icon icon="mdi:clock-outline" width={14} height={14} style={{ marginRight: -1 }} />
      {fmt(value)}
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          cursor: 'pointer',
          width: '100%',
          height: '100%',
        }}
      />
    </label>
  );
}

interface HabitRow {
  time: string;
  freq: ScheduleOption;
  reminder: boolean;
}

// A small, non-editable streak chip. A freshly added habit starts at zero, shown
// in gray so it reads as "your streak starts here," not an active streak.
function StreakChip() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'rgba(15,23,42,0.05)',
        borderRadius: 999,
        padding: '3px 9px',
        fontFamily: FONT,
        fontSize: 12,
        fontWeight: 700,
        color: 'rgb(148,163,184)',
        flexShrink: 0,
      }}
    >
      <Icon icon="mdi:fire" width={14} height={14} style={{ color: 'rgb(148,163,184)' }} />
      0
    </span>
  );
}

// One card per habit. This is the shared element for both paths: the beginner
// picks habits and lands here, the advanced user reads theirs in and lands here
// too. Top row is the habit and its starting streak, then the schedule controls
// (how often + an estimated time), then an opt-in reminder that is off by default.
function HabitCard({
  name,
  row,
  onChange,
}: {
  name: string;
  row: HabitRow;
  onChange: (patch: Partial<HabitRow>) => void;
}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 4px 18px -8px rgba(15,23,42,0.13)',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Row 1: habit name + its starting streak */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 15,
            fontWeight: 700,
            color: 'rgb(15,23,42)',
            flex: 1,
            lineHeight: 1.25,
          }}
        >
          {name}
        </span>
        <StreakChip />
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(15,23,42,0.06)', margin: '0 -2px' }} />

      {/* Row 2: how often (frequency) + when (estimated time) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <FreqPicker value={row.freq} onChange={(f) => onChange({ freq: f })} />
        <TimePill value={row.time} onChange={(t) => onChange({ time: t })} />
      </div>

      {/* Row 3: opt-in reminder, off by default and de-emphasized */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 7 }}>
        <Icon
          icon="mdi:bell-outline"
          width={14}
          height={14}
          style={{ color: row.reminder ? BLUE : 'rgb(148,163,184)' }}
        />
        <span
          style={{
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 600,
            color: row.reminder ? 'rgb(15,23,42)' : 'rgb(148,163,184)',
            transition: 'color 140ms ease-out',
          }}
        >
          Remind me
        </span>
        <Toggle
          checked={row.reminder}
          onChange={(v) => onChange({ reminder: v })}
          ariaLabel={`Reminder for ${name}`}
        />
      </div>
    </div>
  );
}

function HabitScheduleBeat(props?: Record<string, string>) {
  const flow = useFlowState();

  // Use habits from shared flow state if available, otherwise fall back to sample list.
  const habits = flow && flow.habits.length > 0 ? flow.habits : DEFAULT_HABITS;

  const [rows, setRows] = useState<Record<string, HabitRow>>(() =>
    Object.fromEntries(
      habits.map((h) => [
        h,
        { time: defaultTime(h), freq: 'Every day' as ScheduleOption, reminder: false },
      ])
    )
  );

  function patchRow(habit: string, patch: Partial<HabitRow>) {
    setRows((prev) => ({ ...prev, [habit]: { ...prev[habit], ...patch } }));
  }

  const cards = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {habits.map((h) => (
        <HabitCard
          key={h}
          name={h}
          row={rows[h] ?? { time: '08:00', freq: 'Every day', reminder: false }}
          onChange={(patch) => patchRow(h, patch)}
        />
      ))}
    </div>
  );

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say:
        props?.coachLine ??
        "When will you do each one? Add a reminder only if you want a nudge.",
    },
    {
      id: 'cards',
      speaker: 'coach',
      render: cards,
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const habitScheduleBeat: BeatDef = {
  type: 'habit-schedule',
  group: 'Onboarding',
  label: 'Habit schedule',
  Comp: HabitScheduleBeat,
};

export default habitScheduleBeat;
