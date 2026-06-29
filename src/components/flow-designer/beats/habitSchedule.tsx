import { useEffect, useState } from 'react';
import { HabitScheduleCard, type HabitPolarity } from '@/components/onboarding/HabitScheduleCard';
import { WEEKDAYS, toggleSetItem } from '@/components/onboarding/constants';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';

const DEFAULT_HABITS = ['Morning walk', 'Read 10 pages', 'No screens after 10'];

// Per-habit local state: which days are selected and the polarity (Build/Break).
// Time and reminder are not part of the HabitScheduleCard surface; the beginner
// path collects days + polarity here. Time can be added in a follow-on beat if
// needed. Polarity defaults to 'build' for all habits, auto-classify comes later.
interface HabitCfg {
  days: Set<number>;
  polarity: HabitPolarity;
}

function HabitScheduleBeat(props?: Record<string, string>) {
  const flow = useFlowState();

  // Read habits from flow state (set by the habit-pick beat). Fall back to the
  // sample list when rendering as a static tile on the build canvas (no provider).
  const habits = flow && flow.habits.length > 0 ? flow.habits : DEFAULT_HABITS;

  const [cfgs, setCfgs] = useState<Record<string, HabitCfg>>(() =>
    Object.fromEntries(
      habits.map((h) => [h, { days: new Set(WEEKDAYS), polarity: 'build' as HabitPolarity }])
    )
  );

  // Lift the selected days to shared flow state so the plan recap and home tour
  // reflect the real schedule the user set. Days stored as a sorted array (plain
  // serializable, not a Set). Time and reminder default to '08:00' / false until a
  // dedicated beat collects them.
  useEffect(() => {
    if (!flow) return;
    for (const [name, cfg] of Object.entries(cfgs)) {
      flow.setHabitConfig(name, {
        days: [...cfg.days].sort((a, b) => a - b),
        time: '08:00',
        reminder: false,
      });
    }
    // react to the config map only; flow is a stable ref at call time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfgs]);

  function patchPolarity(habit: string, polarity: HabitPolarity) {
    setCfgs((prev) => ({ ...prev, [habit]: { ...prev[habit], polarity } }));
  }
  function toggleDay(habit: string, day: number) {
    setCfgs((prev) => ({
      ...prev,
      [habit]: { ...prev[habit], days: toggleSetItem(prev[habit].days, day) },
    }));
  }
  function get(habit: string): HabitCfg {
    return cfgs[habit] ?? { days: new Set(WEEKDAYS), polarity: 'build' };
  }

  const cards = (
    <div className="flex w-full max-w-[360px] flex-col gap-4">
      {habits.map((h) => {
        const cfg = get(h);
        return (
          <HabitScheduleCard
            key={h}
            habitName={h}
            polarity={cfg.polarity}
            selectedDays={cfg.days}
            onChangePolarity={(p) => patchPolarity(h, p)}
            onToggleDay={(d) => toggleDay(h, d)}
            onEdit={() => {
              // Edit is a no-op in the flow-builder preview. The real app opens the
              // habit edit sheet from here; a follow-on wiring session adds that.
            }}
          />
        );
      })}
    </div>
  );

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say:
        props?.coachLine ??
        'For each habit, choose which days work for you. Build means adding something new, Break means moving away from something.',
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
