import { Icon } from '@iconify/react';
import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WEEKDAYS } from '@/components/onboarding/constants';
import { HabitSummaryCard } from '@/components/onboarding/HabitSummaryCard';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';

interface HabitItem {
  name: string;
  days: Set<number>;
  selected: boolean;
}

interface UpdatedHabit {
  index: number;
  name: string;
  days: number[];
}

interface ResultsLocationState {
  updatedHabit?: UpdatedHabit;
  deletedIndex?: number;
}

const MOCK_HABITS: HabitItem[] = [
  { name: 'Sleep by 11 PM', days: new Set(WEEKDAYS), selected: true },
  { name: 'Morning stretch', days: new Set(WEEKDAYS), selected: true },
  { name: 'No coffee after 3 PM', days: new Set(WEEKDAYS), selected: true },
];

function applyLocationState(base: HabitItem[], state: ResultsLocationState | null): HabitItem[] {
  if (!state) return base;
  let result = base;
  if (state.updatedHabit) {
    const { index, name, days } = state.updatedHabit;
    result = result.map((h, i) => (i === index ? { ...h, name, days: new Set(days) } : h));
  }
  if (state.deletedIndex !== undefined) {
    result = result.filter((_, i) => i !== state.deletedIndex);
  }
  return result;
}

export function AdvancedResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as ResultsLocationState | null;
  const clearedRef = useRef(false);

  const habits = useMemo(() => applyLocationState(MOCK_HABITS, locationState), [locationState]);

  useEffect(() => {
    if (locationState && !clearedRef.current) {
      clearedRef.current = true;
      window.history.replaceState({}, '');
    }
  }, [locationState]);

  function handleConfirm() {
    const habitConfigs = habits.map((h) => ({
      name: h.name,
      days: [...h.days],
    }));
    navigate('/onboarding/advanced-step-6', { state: { habitConfigs } });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f9f9f9]">
      {/* Top Nav */}
      <div className="px-[24px] pt-[max(16px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate('/onboarding/advanced-input')}
          className="mb-[12px] flex size-[40px] items-center justify-center rounded-full"
        >
          <Icon icon="ic:round-arrow-back" width={16} height={16} className="text-content" />
        </button>
        <OnboardingProgress currentStep={4} totalSteps={6} />
      </div>

      {/* Header */}
      <div className="flex flex-col gap-[11px] px-[24px]">
        <h1 className="text-[32px] font-bold leading-[40px] tracking-[-0.8px] text-[#0a2540]">
          We organized this for you
        </h1>
        <p className="text-[18px] font-medium leading-[29.25px] text-[#64748b]">
          Here is the cleanest place to start based on what you shared.
        </p>
      </div>

      {/* Habit Cards */}
      <div className="flex flex-1 flex-col gap-[16px] overflow-y-auto px-[24px] pt-[24px]">
        {habits.map((habit, i) => (
          <HabitSummaryCard
            key={i}
            habitName={habit.name}
            selectedDays={habit.days}
            onEdit={() =>
              navigate('/onboarding/edit-habit', {
                state: {
                  habitIndex: i,
                  habitName: habit.name,
                  days: Array.from(habit.days),
                  time: '21:45',
                },
              })
            }
            showCheckmark
            showAiIcon
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center gap-[16px] px-[24px] pb-[40px] pt-[32px]">
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full rounded-full bg-primary py-[16px] text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25),0px_4px_6px_-4px_rgba(19,91,236,0.25)]"
        >
          Confirm & Continue
        </button>
        <button type="button" className="text-[16px] font-semibold text-[#64748b]">
          Regenerate
        </button>
      </div>
    </div>
  );
}
