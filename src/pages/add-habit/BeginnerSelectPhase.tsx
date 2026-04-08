import type { HabitConfig } from '@/components/onboarding/HabitCustomizeSheet';
import { HabitCustomizeSheet } from '@/components/onboarding/HabitCustomizeSheet';
import { HabitPickerPanel } from '@/components/onboarding/HabitPickerPanel';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { AddHabitHeader } from './AddHabitHeader';

interface CategoryData {
  category: string;
  habits: string[];
}

interface BeginnerSelectPhaseProps {
  categories: CategoryData[];
  expandedCategory: string;
  setExpandedCategory: (fn: (prev: string) => string) => void;
  selectedHabits: Set<string>;
  customHabits: Record<string, string[]>;
  toggleHabit: (habit: string) => void;
  addCustomHabit: (category: string, habit: string) => void;
  onContinue: () => void;
  customizingHabit: string | null;
  onSheetClose: () => void;
  onSheetNext: (config: HabitConfig) => void;
  isLastHabit: boolean;
  onBack: () => void;
}

export function BeginnerSelectPhase({
  categories,
  expandedCategory,
  setExpandedCategory,
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
}: BeginnerSelectPhaseProps) {
  return (
    <>
      <div className="flex min-h-dvh flex-col bg-primary-bg px-5 pb-[120px] pt-[max(16px,env(safe-area-inset-top))]">
        <AddHabitHeader onBack={onBack} />
        <p className="mb-6 text-[15px] leading-relaxed text-content-secondary">
          Select up to 2 daily habits to add to your routine.
        </p>
        <div className="flex flex-col gap-4">
          {categories.map(({ category, habits }) => (
            <HabitPickerPanel
              key={category}
              goal={category}
              habits={[...habits, ...(customHabits[category] ?? [])]}
              expanded={expandedCategory === category}
              onToggleExpanded={() =>
                setExpandedCategory((prev) => (prev === category ? '' : category))
              }
              selectedHabits={selectedHabits}
              maxReached={selectedHabits.size >= 2}
              onToggleHabit={toggleHabit}
              onAddCustomHabit={(habit) => addCustomHabit(category, habit)}
            />
          ))}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 bg-primary-bg px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          disabled={selectedHabits.size === 0}
          onClick={onContinue}
          className="h-[56px] w-full rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25)] disabled:opacity-50"
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
