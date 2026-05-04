import { useMemo, useState } from 'react';
import type { HabitConfig } from '@/components/onboarding/HabitCustomizeSheet';
import { HabitCustomizeSheet } from '@/components/onboarding/HabitCustomizeSheet';
import { HabitPickerPanel } from '@/components/onboarding/HabitPickerPanel';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { goalsByCategory, habitsByGoal } from '@/data/onboardingHabits';
import { AddHabitHeader } from './AddHabitHeader';

interface BeginnerHabitsPhaseProps {
  selectedCategory: string;
  selectedGoals: Set<string>;
  selectedHabits: Set<string>;
  customHabits: Record<string, string[]>;
  toggleHabit: (habit: string) => void;
  addCustomHabit: (goal: string, habit: string) => void;
  onContinue: () => void;
  customizingHabit: string | null;
  onSheetClose: () => void;
  onSheetNext: (config: HabitConfig) => void;
  isLastHabit: boolean;
  onBack: () => void;
}

export function BeginnerHabitsPhase({
  selectedCategory,
  selectedGoals,
  selectedHabits,
  customHabits,
  toggleHabit,
  addCustomHabit,
  onContinue,
  customizingHabit,
  onSheetClose,
  onSheetNext,
  isLastHabit,
  onBack,
}: BeginnerHabitsPhaseProps) {
  const orderedGoals = useMemo(
    () => (goalsByCategory[selectedCategory] ?? []).filter((g) => selectedGoals.has(g)),
    [selectedCategory, selectedGoals],
  );
  const [expandedGoal, setExpandedGoal] = useState<string>(() => orderedGoals[0] ?? '');

  return (
    <>
      <div className="flex min-h-dvh flex-col bg-primary-bg px-5 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
        <AddHabitHeader onBack={onBack} />
        <div className="mb-6 flex flex-col gap-[11px]">
          <h2 className="text-[28px] font-bold leading-[36px] tracking-[-0.5px] text-content">
            Here's a good place to start
          </h2>
          <p className="text-[16px] font-medium leading-[26px] text-content-secondary">
            Select up to 2 daily habits to add to your routine.
          </p>
        </div>
        <div className="mb-8 flex flex-col gap-[16px]">
          {orderedGoals.map((goal) => (
            <HabitPickerPanel
              key={goal}
              goal={goal}
              habits={[...(habitsByGoal[goal] ?? []), ...(customHabits[goal] ?? [])]}
              expanded={expandedGoal === goal}
              onToggleExpanded={() =>
                setExpandedGoal((prev) => (prev === goal ? '' : goal))
              }
              selectedHabits={selectedHabits}
              maxReached={selectedHabits.size >= 2}
              onToggleHabit={toggleHabit}
              onAddCustomHabit={(habit) => addCustomHabit(goal, habit)}
            />
          ))}
        </div>
        <button
          type="button"
          disabled={selectedHabits.size === 0}
          onClick={onContinue}
          className="mt-auto h-[56px] w-full rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25)] disabled:opacity-50"
        >
          Continue
        </button>
      </div>
      {customizingHabit && (
        <BottomSheet onClose={onSheetClose}>
          <HabitCustomizeSheet
            key={customizingHabit}
            habitName={customizingHabit}
            onClose={onSheetClose}
            onNext={onSheetNext}
            isLastHabit={isLastHabit}
          />
        </BottomSheet>
      )}
    </>
  );
}
