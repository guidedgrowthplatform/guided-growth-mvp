import { useState } from 'react';
import { HabitPickerPanel } from '@/components/onboarding/HabitPickerPanel';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

function HabitPickerBeat(props?: Record<string, string>) {
  const [expanded, setExpanded] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set(['No screens after 10 PM']));
  const habits = [
    'No caffeine after 2 PM',
    'No screens after 10 PM',
    'Start wind-down by 10 PM',
    'Be in bed by target bedtime',
  ];

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say: props?.coachLine ?? "Here are a few habits that fit. Pick the ones you'll actually do.",
    },
    {
      id: 'show',
      speaker: 'coach',
      render: (
        <HabitPickerPanel
          goal="Fall asleep earlier"
          habits={habits}
          expanded={expanded}
          onToggleExpanded={() => setExpanded((v) => !v)}
          selectedHabits={sel}
          onToggleHabit={(h) =>
            setSel((p) => {
              const n = new Set(p);
              if (n.has(h)) n.delete(h);
              else n.add(h);
              return n;
            })
          }
          onAddCustomHabit={(h) => setSel((p) => new Set(p).add(h))}
        />
      ),
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const habitPickerBeat: BeatDef = {
  type: 'habit-picker',
  group: 'Onboarding',
  label: 'Habit picker',
  Comp: HabitPickerBeat,
};

export default habitPickerBeat;
