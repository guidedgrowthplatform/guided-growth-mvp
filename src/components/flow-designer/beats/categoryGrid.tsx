import { useState } from 'react';
import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { type BeatDef } from '../beatKit';

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
  const [sel, setSel] = useState('Sleep better');
  return (
    <div className="grid grid-cols-2 gap-3">
      {CATS.map((c) => (
        <CategoryCard
          key={c.label}
          image={c.image}
          label={c.label}
          selected={sel === c.label}
          onSelect={() => setSel(c.label)}
        />
      ))}
    </div>
  );
}

const categoryGridBeat: BeatDef = {
  type: 'category-grid',
  group: 'Onboarding',
  label: 'Category tiles',
  Comp: CategoryGrid,
};

export default categoryGridBeat;
