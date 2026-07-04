import { useState } from 'react';
import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';

const CATS = [
  { label: 'Sleep better', image: '/images/onboarding/sleep-better.png' },
  { label: 'Move more', image: '/images/onboarding/move-more.jpg' },
  { label: 'Eat better', image: '/images/onboarding/eat-better.png' },
  { label: 'Feel more energized', image: '/images/onboarding/feel-more-energized.png' },
  { label: 'Reduce stress', image: '/images/onboarding/reduce-stress.png' },
  { label: 'Improve focus', image: '/images/onboarding/improve-focus.jpg' },
  { label: 'Break bad habits', image: '/images/onboarding/break-bad-habits.png' },
  { label: 'Get more organized', image: '/images/onboarding/get-more-organized.png' },
];

function CategoryGrid(props?: Record<string, string>) {
  // In Play the pick writes to shared flow state so the goals beat reads it; on
  // the static canvas there is no provider, so fall back to local state.
  const flow = useFlowState();
  const [localSel, setLocalSel] = useState<string | null>('Sleep better');
  const sel = flow ? flow.category : localSel;
  const pick = (label: string) => (flow ? flow.setCategory(label) : setLocalSel(label));

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say: props?.coachLine ?? 'What part of your life do you most want to grow right now?',
    },
    {
      id: 'show',
      speaker: 'coach',
      render: (
        <div className="grid grid-cols-2 gap-3">
          {CATS.map((c) => (
            <CategoryCard
              key={c.label}
              image={c.image}
              label={c.label}
              selected={sel === c.label}
              onSelect={() => pick(c.label)}
            />
          ))}
        </div>
      ),
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const categoryGridBeat: BeatDef = {
  type: 'category-grid',
  group: 'Onboarding',
  label: 'Category tiles',
  Comp: CategoryGrid,
};

export default categoryGridBeat;
