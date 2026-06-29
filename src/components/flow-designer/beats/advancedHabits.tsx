import { useState } from 'react';
import { HabitScheduleCard, type HabitPolarity } from '@/components/onboarding/HabitScheduleCard';
import { toggleSetItem, WEEKDAYS } from '@/components/onboarding/constants';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';

// Beat 1 of the advanced schedule split.
//
// Shows every habit the user described in the capture beat, one card per habit,
// with the Build / Break chip. The day-circle picker is intentionally hidden here
// (showDays={false}) so the coach can frame polarity first. Beat 2 (advancedFrequency)
// adds the day circles in a separate conversation turn.
//
// Polarity state is kept local to this beat. The day-selection state that Beat 2
// needs is seeded from WEEKDAYS here and owned by the advancedFrequency beat so
// the two beats are independent components (no cross-beat shared state required
// beyond what FlowState already provides).

const SAMPLE_HABITS = ['Morning walk', 'No screens after 10 PM', 'Meditate 5 minutes'];

interface HabitEntry {
  name: string;
  polarity: HabitPolarity;
  days: Set<number>;
}

function AdvancedHabitsBeat(props?: Record<string, string>) {
  const flow = useFlowState();
  const habits = flow && flow.habits.length > 0 ? flow.habits : SAMPLE_HABITS;

  const [entries, setEntries] = useState<HabitEntry[]>(() =>
    habits.map((name) => ({ name, polarity: 'build' as HabitPolarity, days: new Set(WEEKDAYS) }))
  );

  function changePolarity(idx: number, polarity: HabitPolarity) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, polarity } : e)));
  }

  // Edit and delete are no-ops in this preview beat; real wiring happens in the engine.
  const cards = (
    <div className="flex w-full max-w-[360px] flex-col gap-4">
      {entries.map((e, idx) => (
        <HabitScheduleCard
          key={e.name}
          habitName={e.name}
          polarity={e.polarity}
          selectedDays={e.days}
          onChangePolarity={(p) => changePolarity(idx, p)}
          onToggleDay={() => undefined}
          onEdit={() => undefined}
          showDays={false}
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
        'Here are the habits you mentioned. For each one, choose Build if you want to do more of it, or Break if you want to stop.',
    },
    { id: 'cards', speaker: 'coach', render: cards },
    {
      id: 'confirm',
      speaker: 'coach',
      say:
        props?.confirmCoachLine ??
        'Got it. Now we will set which days work for each habit.',
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const advancedHabitsBeat: BeatDef = {
  type: 'advanced-habits',
  group: 'Onboarding',
  label: 'Advanced habits (Build / Break)',
  Comp: AdvancedHabitsBeat,
};

export default advancedHabitsBeat;
