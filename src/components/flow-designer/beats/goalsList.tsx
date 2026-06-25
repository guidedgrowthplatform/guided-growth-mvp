import { useState } from 'react';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

function GoalsListBeat(props?: Record<string, string>) {
  const goals = [
    'Fall asleep earlier',
    'Wake up earlier',
    'Sleep more consistently',
    'Sleep more deeply',
  ];
  const [sel, setSel] = useState<Set<string>>(new Set(['Fall asleep earlier']));

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say: props?.coachLine ?? 'Which of these feels most true for you?',
    },
    {
      id: 'show',
      speaker: 'coach',
      render: (
        <div className="flex flex-col gap-3">
          {goals.map((g) => (
            <GoalCard
              key={g}
              label={g}
              selected={sel.has(g)}
              onToggle={() =>
                setSel((p) => {
                  const n = new Set(p);
                  if (n.has(g)) n.delete(g);
                  else n.add(g);
                  return n;
                })
              }
            />
          ))}
        </div>
      ),
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const goalsListBeat: BeatDef = {
  type: 'goals-list',
  group: 'Onboarding',
  label: 'Goal cards',
  Comp: GoalsListBeat,
};

export default goalsListBeat;
