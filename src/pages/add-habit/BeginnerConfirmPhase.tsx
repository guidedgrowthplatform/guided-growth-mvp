import type { HabitConfig } from '@/components/onboarding/HabitCustomizeSheet';
import { HabitCustomizeSheet } from '@/components/onboarding/HabitCustomizeSheet';
import { HabitSummaryCard } from '@/components/onboarding/HabitSummaryCard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { AddHabitHeader } from './AddHabitHeader';

interface BeginnerConfirmPhaseProps {
  habitConfigs: Record<string, HabitConfig>;
  onEditHabit: (habit: string) => void;
  onConfirm: () => void;
  saving: boolean;
  customizingHabit: string | null;
  onSheetClose: () => void;
  onSheetNext: (config: HabitConfig) => void;
  isLastHabit: boolean;
  onBack: () => void;
}

export function BeginnerConfirmPhase({
  habitConfigs,
  onEditHabit,
  onConfirm,
  saving,
  customizingHabit,
  onSheetClose,
  onSheetNext,
  isLastHabit,
  onBack,
}: BeginnerConfirmPhaseProps) {
  return (
    <>
      <div className="flex min-h-dvh flex-col bg-primary-bg px-5 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
        <AddHabitHeader onBack={onBack} />
        <div className="mb-8 flex flex-col gap-4">
          {Object.entries(habitConfigs).map(([habit, config]) => (
            <HabitSummaryCard
              key={habit}
              habitName={habit}
              selectedDays={config.days}
              onEdit={() => onEditHabit(habit)}
            />
          ))}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={onConfirm}
          className="mt-auto h-[56px] w-full rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25)] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Confirm & Add'}
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
