import { Icon } from '@iconify/react';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { goalsByCategory } from '@/data/onboardingHabits';
import { AddHabitHeader } from './AddHabitHeader';

interface BeginnerGoalsPhaseProps {
  selectedCategory: string;
  selectedGoals: Set<string>;
  toggleGoal: (g: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function BeginnerGoalsPhase({
  selectedCategory,
  selectedGoals,
  toggleGoal,
  onContinue,
  onBack,
}: BeginnerGoalsPhaseProps) {
  const goals = goalsByCategory[selectedCategory] ?? [];
  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg px-5 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
      <AddHabitHeader onBack={onBack} />
      <div className="mb-6 flex flex-col gap-[11px]">
        <h2 className="text-[28px] font-bold leading-[36px] tracking-[-0.5px] text-content">
          Let's narrow it down
        </h2>
        <p className="text-[16px] font-medium leading-[26px] text-content-secondary">
          {`Choose 1 or 2 specific goals to help you ${selectedCategory.toLowerCase()}`}
        </p>
      </div>
      <div className="mb-4 inline-flex items-center gap-1 self-start rounded-[10px] bg-surface px-2 py-1">
        <Icon icon="iconamoon:category" width={24} height={24} className="text-content" />
        <span className="text-[16px] font-bold leading-[24px] text-content">Category:</span>
        <span className="text-[16px] font-bold leading-[24px] text-content">
          {selectedCategory}
        </span>
      </div>
      <div className="mb-8 flex flex-col gap-[16px]">
        {goals.map((g) => (
          <GoalCard
            key={g}
            label={g}
            selected={selectedGoals.has(g)}
            disabled={!selectedGoals.has(g) && selectedGoals.size >= 2}
            onToggle={() => toggleGoal(g)}
          />
        ))}
      </div>
      <button
        type="button"
        disabled={selectedGoals.size === 0}
        onClick={onContinue}
        className="mt-auto h-[56px] w-full rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25)] disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  );
}
