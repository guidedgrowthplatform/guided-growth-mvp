import { Icon } from '@iconify/react';
import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WEEKDAYS } from '@/components/onboarding/constants';
import { HabitSummaryCard } from '@/components/onboarding/HabitSummaryCard';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { useOnboarding } from '@/hooks/useOnboarding';
import { parseHabitsFromText } from '@/lib/utils/parse-habits-from-text';

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
  text?: string;
  habits?: Array<{ name: string; days?: number[] }>;
}

const FALLBACK_HABITS: HabitItem[] = [
  { name: 'Sleep by 11 PM', days: new Set(WEEKDAYS), selected: true },
  { name: 'Morning stretch', days: new Set(WEEKDAYS), selected: true },
  { name: 'No coffee after 3 PM', days: new Set(WEEKDAYS), selected: true },
];

function buildInitialHabits(state: ResultsLocationState | null): HabitItem[] {
  // If structured habits were passed directly, use them
  if (state?.habits && state.habits.length > 0) {
    return state.habits.map((h) => ({
      name: h.name,
      days: new Set(h.days ?? WEEKDAYS),
      selected: true,
    }));
  }

  // Parse free-form "brain dump" text into structured habits
  if (state?.text) {
    const parsed = parseHabitsFromText(state.text);
    if (parsed.length > 0) {
      return parsed.map((h) => ({
        name: h.name,
        days: new Set(WEEKDAYS),
        selected: true,
      }));
    }
  }

  return FALLBACK_HABITS;
}

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
  const { saveStepAsync } = useOnboarding();
  const locationState = location.state as ResultsLocationState | null;
  const clearedRef = useRef(false);

  const baseHabits = useMemo(() => buildInitialHabits(locationState), [locationState]);
  const habits = useMemo(
    () => applyLocationState(baseHabits, locationState),
    [baseHabits, locationState],
  );

  useEffect(() => {
    if (locationState && !clearedRef.current) {
      clearedRef.current = true;
      window.history.replaceState({}, '');
    }
  }, [locationState]);

  const handleConfirm = useCallback(async () => {
    const habitConfigsArray = habits.map((h) => ({
      name: h.name,
      days: [...h.days],
    }));
    const goals = habits.map((h) => h.name);
    const habitConfigsRecord: Record<string, { days: number[]; time: string; reminder: boolean }> =
      {};
    habitConfigsArray.forEach((h) => {
      habitConfigsRecord[h.name] = { days: h.days, time: '21:45', reminder: true };
    });
    await saveStepAsync(4, { goals, habitConfigs: habitConfigsRecord });
    navigate('/onboarding/advanced-step-6', { state: { habitConfigs: habitConfigsArray } });
  }, [habits, navigate, saveStepAsync]);

  if (habits.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-secondary">
        <p className="text-content-secondary">No habits selected. Go back to add some.</p>
        <button
          type="button"
          onClick={() => navigate('/onboarding/advanced-input')}
          className="mt-4 rounded-full bg-primary px-6 py-3 text-white"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface-secondary">
      {/* Top Nav */}
      <div className="px-6 pt-[max(16px,env(safe-area-inset-top))]">
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
      <div className="flex flex-col gap-[11px] px-6">
        <h1 className="text-[32px] font-bold leading-[40px] tracking-[-0.8px] text-content">
          We organized this for you
        </h1>
        <p className="text-[18px] font-medium leading-[29.25px] text-content-secondary">
          Here is the cleanest place to start based on what you shared.
        </p>
      </div>

      {/* Habit Cards */}
      <div className="flex flex-1 flex-col gap-[16px] overflow-y-auto px-6 pt-[24px]">
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
      <div className="flex flex-col items-center gap-[16px] px-6 pb-[40px] pt-[32px]">
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full rounded-full bg-primary py-[16px] text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25),0px_4px_6px_-4px_rgba(19,91,236,0.25)]"
        >
          Confirm & Continue
        </button>
        <button type="button" className="text-[16px] font-semibold text-content-secondary">
          Regenerate
        </button>
      </div>
    </div>
  );
}
