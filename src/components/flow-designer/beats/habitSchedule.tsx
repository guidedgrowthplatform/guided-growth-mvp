import { useState } from 'react';
import { HabitListItem } from '@/components/home/HabitListItem';
import { DayPicker } from '@/components/ui/DayPicker';
import { TimePicker } from '@/components/ui/TimePicker';
import { Toggle } from '@/components/ui/Toggle';
import { SECTION_LABEL_CLASS, WEEKDAYS, toggleSetItem } from '@/components/onboarding/constants';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';

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

type Status = 'done' | 'missed' | 'none';
interface HabitCfg {
  days: Set<number>;
  time: string;
  reminder: boolean;
  status: Status;
}

// One card per habit, built from the real app components: the HabitListItem row
// (the habit with the check and the X) on top, then the day-circle DayPicker for
// how often, the inline TimePicker for when, and a reminder toggle that is OFF by
// default. The beginner path and the advanced captured-habits path both use this
// same card, so both share these exact components.
function HabitCard({
  name,
  cfg,
  onPatch,
  onToggleDay,
}: {
  name: string;
  cfg: HabitCfg;
  onPatch: (patch: Partial<HabitCfg>) => void;
  onToggleDay: (day: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <HabitListItem
        name={name}
        streak={0}
        isCompleted={cfg.status === 'done'}
        status={cfg.status}
        onToggleComplete={() => onPatch({ status: cfg.status === 'done' ? 'none' : 'done' })}
        onMarkMissed={() => onPatch({ status: cfg.status === 'missed' ? 'none' : 'missed' })}
      />
      <div className="flex flex-col gap-4 px-1.5 pb-1">
        <div className="flex flex-col gap-2">
          <span className={SECTION_LABEL_CLASS}>How often?</span>
          <DayPicker selectedDays={cfg.days} onToggleDay={onToggleDay} />
        </div>
        <div className="flex items-center justify-between">
          <span className={SECTION_LABEL_CLASS}>When?</span>
          <TimePicker value={cfg.time} onChange={(t) => onPatch({ time: t })} />
        </div>
        <div className="flex items-center justify-between">
          <span className={SECTION_LABEL_CLASS}>Remind me</span>
          <Toggle checked={cfg.reminder} onChange={(v) => onPatch({ reminder: v })} ariaLabel={`Reminder for ${name}`} />
        </div>
      </div>
    </div>
  );
}

function HabitScheduleBeat(props?: Record<string, string>) {
  const flow = useFlowState();

  // Use habits from shared flow state if available, otherwise fall back to sample list.
  const habits = flow && flow.habits.length > 0 ? flow.habits : DEFAULT_HABITS;

  const [cfgs, setCfgs] = useState<Record<string, HabitCfg>>(() =>
    Object.fromEntries(
      habits.map((h) => [
        h,
        { days: new Set(WEEKDAYS), time: defaultTime(h), reminder: false, status: 'none' as Status },
      ])
    )
  );

  function patch(habit: string, p: Partial<HabitCfg>) {
    setCfgs((prev) => ({ ...prev, [habit]: { ...prev[habit], ...p } }));
  }
  function toggleDay(habit: string, day: number) {
    setCfgs((prev) => ({
      ...prev,
      [habit]: { ...prev[habit], days: toggleSetItem(prev[habit].days, day) },
    }));
  }
  function get(habit: string): HabitCfg {
    return cfgs[habit] ?? { days: new Set(WEEKDAYS), time: '08:00', reminder: false, status: 'none' };
  }

  const cards = (
    <div className="flex w-full max-w-[360px] flex-col gap-6">
      {habits.map((h) => (
        <HabitCard
          key={h}
          name={h}
          cfg={get(h)}
          onPatch={(p) => patch(h, p)}
          onToggleDay={(d) => toggleDay(h, d)}
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
        'When will you do each one? Pick the days and a time. Add a reminder only if you want a nudge.',
    },
    { id: 'cards', speaker: 'coach', render: cards },
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
