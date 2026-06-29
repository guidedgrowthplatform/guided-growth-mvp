import { useEffect, useState } from 'react';
import { HabitScheduleCard, type HabitPolarity } from '@/components/onboarding/HabitScheduleCard';
import { toggleSetItem, WEEKDAYS } from '@/components/onboarding/constants';
import type { HabitScheduleCfg } from '../flowStateCtx';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';

// Beat 2 of the advanced schedule split.
//
// Shows the same habits from the capture beat, now with the full HabitScheduleCard
// including the day-circle DayPicker (showDays defaults to true). The coach asks
// the user to say which days they want each habit. The day selections are lifted
// to shared FlowState via setHabitConfig so the plan recap and home tour
// reflect the real schedule the user chose.
//
// Polarity is set to 'build' by default here. When the engine wires these two
// beats end-to-end it should pass polarity forward; for now the beat is self-contained
// and the placeholder polarity is correct for most habits.

const SAMPLE_HABITS = ['Morning walk', 'No screens after 10 PM', 'Meditate 5 minutes'];

interface HabitEntry {
  name: string;
  polarity: HabitPolarity;
  days: Set<number>;
}

function AdvancedFrequencyBeat(props?: Record<string, string>) {
  const flow = useFlowState();
  const habits = flow && flow.habits.length > 0 ? flow.habits : SAMPLE_HABITS;

  const [entries, setEntries] = useState<HabitEntry[]>(() =>
    habits.map((name) => ({ name, polarity: 'build' as HabitPolarity, days: new Set(WEEKDAYS) }))
  );

  // Lift day selections to shared flow state whenever they change so the plan
  // recap and home tour show the real schedule the user picked.
  useEffect(() => {
    if (!flow) return;
    for (const e of entries) {
      const cfg: HabitScheduleCfg = {
        days: [...e.days].sort((a, b) => a - b),
        time: '08:00',
        reminder: false,
      };
      flow.setHabitConfig(e.name, cfg);
    }
    // react to entries only; flow is read at call time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  function toggleDay(idx: number, day: number) {
    setEntries((prev) =>
      prev.map((e, i) =>
        i === idx ? { ...e, days: toggleSetItem(e.days, day) } : e
      )
    );
  }

  function changePolarity(idx: number, polarity: HabitPolarity) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, polarity } : e)));
  }

  const cards = (
    <div className="flex w-full max-w-[360px] flex-col gap-4">
      {entries.map((e, idx) => (
        <HabitScheduleCard
          key={e.name}
          habitName={e.name}
          polarity={e.polarity}
          selectedDays={e.days}
          onChangePolarity={(p) => changePolarity(idx, p)}
          onToggleDay={(d) => toggleDay(idx, d)}
          onEdit={() => undefined}
          showDays
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
        'Now for the days. Say which days you want each habit, and the circles will update.',
    },
    { id: 'cards', speaker: 'coach', render: cards },
    {
      id: 'confirm',
      speaker: 'coach',
      say:
        props?.confirmCoachLine ??
        'Perfect. Your habits are all set. Your plan is ready.',
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const advancedFrequencyBeat: BeatDef = {
  type: 'advanced-frequency',
  group: 'Onboarding',
  label: 'Advanced frequency (day circles)',
  Comp: AdvancedFrequencyBeat,
};

export default advancedFrequencyBeat;
