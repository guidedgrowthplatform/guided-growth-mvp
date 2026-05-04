import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { AddHabitHeader } from './AddHabitHeader';

const CATEGORY_OPTIONS: ReadonlyArray<{ label: string; image: string }> = [
  { label: 'Sleep better', image: '/images/onboarding/sleep-better.png' },
  { label: 'Move more', image: '/images/onboarding/move-more.jpg' },
  { label: 'Eat better', image: '/images/onboarding/eat-better.png' },
  { label: 'Feel more energized', image: '/images/onboarding/feel-more-energized.png' },
  { label: 'Reduce stress', image: '/images/onboarding/reduce-stress.png' },
  { label: 'Improve focus', image: '/images/onboarding/improve-focus.jpg' },
  { label: 'Break bad habits', image: '/images/onboarding/break-bad-habits.png' },
  { label: 'Get more organized', image: '/images/onboarding/get-more-organized.png' },
];

interface BeginnerCategoryPhaseProps {
  selectedCategory: string | null;
  onSelectCategory: (c: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function BeginnerCategoryPhase({
  selectedCategory,
  onSelectCategory,
  onContinue,
  onBack,
}: BeginnerCategoryPhaseProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg px-5 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
      <AddHabitHeader onBack={onBack} />
      <div className="mb-8 flex flex-col gap-[11px]">
        <h2 className="text-[28px] font-bold leading-[36px] tracking-[-0.5px] text-content">
          What feels most worth improving right now?
        </h2>
        <p className="text-[16px] font-medium leading-[26px] text-content-secondary">
          Pick one area to start. You can always add more later.
        </p>
      </div>
      <div className="mb-8 grid grid-cols-2 gap-[16px]">
        {CATEGORY_OPTIONS.map((c) => (
          <CategoryCard
            key={c.label}
            image={c.image}
            label={c.label}
            selected={selectedCategory === c.label}
            onSelect={() => onSelectCategory(c.label)}
          />
        ))}
      </div>
      <button
        type="button"
        disabled={!selectedCategory}
        onClick={onContinue}
        className="mt-auto h-[56px] w-full rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25)] disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  );
}
