import { useState } from 'react';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';
import { goalsByCategory } from '@/data/onboardingHabits';

const MAX_GOALS = 2;

function GoalsListBeat(props?: Record<string, string>) {
  // The list is the real subcategories of the category picked upstream. In Play
  // that comes from shared flow state; on the canvas it defaults to Sleep better
  // so the tile still shows real data.
  const flow = useFlowState();
  const category = flow?.category ?? 'Sleep better';
  const goals = goalsByCategory[category] ?? goalsByCategory['Sleep better'] ?? [];
  const [localSel, setLocalSel] = useState<string[]>([]);
  const selected = flow ? flow.goals : localSel;
  const toggle = (g: string) =>
    flow
      ? flow.toggleGoal(g, MAX_GOALS)
      : setLocalSel((p) =>
          p.includes(g) ? p.filter((x) => x !== g) : p.length < MAX_GOALS ? [...p, g] : p,
        );

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
          {goals.map((g) => {
            const on = selected.includes(g);
            return (
              <GoalCard
                key={g}
                label={g}
                selected={on}
                disabled={!on && selected.length >= MAX_GOALS}
                onToggle={() => toggle(g)}
              />
            );
          })}
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
