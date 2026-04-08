import { HabitSummaryCard } from '@/components/onboarding/HabitSummaryCard';
import { AddHabitHeader } from './AddHabitHeader';
import type { HabitItem } from './types';

interface AdvancedResultsPhaseProps {
  advancedHabits: HabitItem[];
  onEditHabit: (index: number) => void;
  onConfirm: () => void;
  saving: boolean;
  onStartOver: () => void;
  onBack: () => void;
}

export function AdvancedResultsPhase({
  advancedHabits,
  onEditHabit,
  onConfirm,
  saving,
  onStartOver,
  onBack,
}: AdvancedResultsPhaseProps) {
  if (advancedHabits.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-primary-bg px-5">
        <p className="text-content-secondary">No habits found. Go back and try again.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 rounded-full bg-primary px-6 py-3 text-white"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg">
      <div className="px-5 pt-[max(16px,env(safe-area-inset-top))]">
        <AddHabitHeader onBack={onBack} />
      </div>
      <div className="flex flex-col gap-[11px] px-5">
        <h2 className="text-[28px] font-bold leading-[36px] tracking-[-0.5px] text-content">
          We organized this for you
        </h2>
        <p className="text-[16px] font-medium leading-[26px] text-content-secondary">
          Here are the habits based on what you shared. Edit anything that doesn't look right.
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pt-6">
        {advancedHabits.map((habit, i) => (
          <HabitSummaryCard
            key={habit.name}
            habitName={habit.name}
            selectedDays={habit.days}
            onEdit={() => onEditHabit(i)}
            showCheckmark
            showAiIcon
          />
        ))}
      </div>
      <div className="flex flex-col items-center gap-4 px-5 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-8">
        <button
          type="button"
          disabled={saving}
          onClick={onConfirm}
          className="w-full rounded-full bg-primary py-4 text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25)] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Confirm & Add'}
        </button>
        <button
          type="button"
          onClick={onStartOver}
          className="text-[16px] font-semibold text-content-secondary"
        >
          Start Over
        </button>
      </div>
    </div>
  );
}
