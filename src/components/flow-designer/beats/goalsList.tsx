import { useState } from 'react';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';
import { goalsByCategory } from '@/data/onboardingHabits';

// The user picks 1 or 2 subcategories within their chosen category. The
// underlying flow state field is still named "goals" (a shared-package type),
// but the UX language is "subcategory" throughout, per the v3 spec.
const MAX_SUBCATEGORIES = 2;

function GoalsListBeat(props?: Record<string, string>) {
  // Subcategory list is driven by the category picked upstream. In Play that
  // comes from shared flow state; on the canvas it defaults to "Sleep better"
  // so the tile still shows real options.
  const flow = useFlowState();
  const category = flow?.category ?? 'Sleep better';
  const subcategories = goalsByCategory[category] ?? goalsByCategory['Sleep better'] ?? [];
  const [localSel, setLocalSel] = useState<string[]>([]);
  const selected = flow ? flow.goals : localSel;
  const toggle = (sub: string) =>
    flow
      ? flow.toggleGoal(sub, MAX_SUBCATEGORIES)
      : setLocalSel((prev) =>
          prev.includes(sub)
            ? prev.filter((x) => x !== sub)
            : prev.length < MAX_SUBCATEGORIES
              ? [...prev, sub]
              : prev,
        );

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say: props?.coachLine ?? 'Pick one or two subcategories that feel right.',
    },
    {
      id: 'show',
      speaker: 'coach',
      render: (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-content-secondary">
            Subcategory
          </p>
          {subcategories.map((sub) => {
            const on = selected.includes(sub);
            return (
              <GoalCard
                key={sub}
                label={sub}
                selected={on}
                disabled={!on && selected.length >= MAX_SUBCATEGORIES}
                onToggle={() => toggle(sub)}
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
  label: 'Subcategory picker',
  Comp: GoalsListBeat,
};

export default goalsListBeat;
