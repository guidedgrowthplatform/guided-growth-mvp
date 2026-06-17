import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { useOnboarding } from '@/hooks/useOnboarding';
import { categories, categoryImage } from '@/lib/onboarding/categoryTiles';
import { AddHabitHeader } from './AddHabitHeader';

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
  const { state: onboardingState } = useOnboarding();
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
        {categories.map((c, i) => (
          <CategoryCard
            key={c.label}
            image={categoryImage(c, i, onboardingState?.data?.gender)}
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
