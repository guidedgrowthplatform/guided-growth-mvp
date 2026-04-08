import { Icon } from '@iconify/react';
import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WEEKDAYS } from '@/components/onboarding/constants';
import { HabitSummaryCard } from '@/components/onboarding/HabitSummaryCard';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { useOnboarding } from '@/hooks/useOnboarding';
import { speakWhenReady, stopTTS } from '@/lib/services/tts-service';
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

// NOTE: no fallback habits. Mint reported on 2026-04-09 that the AI
// was generating habits the user never entered (the old FALLBACK_HABITS
// constant contained "Sleep by 11 PM", "Morning stretch", "No coffee
// after 3 PM" which appeared for every vague brain-dump). Per the
// feedback: if parsing produces nothing, send the user back to the
// input screen with a clarification prompt. Never invent habits.

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

  // Explicit empty state — triggers the "no habits" UI below.
  return [];
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

  // TTS auto-play per Voice Journey Spreadsheet v3.
  // Message branches depending on whether we parsed anything — if the
  // user's brain dump was too vague, ask for clarification instead of
  // pretending we built something.
  const hasParsedHabits = habits.length > 0;
  useEffect(() => {
    const message = hasParsedHabits
      ? "Here's what I put together from what you told me. Take a look — you can edit anything, or if it's way off, I'll start fresh."
      : "I didn't quite catch anything specific to turn into habits. Could you tell me a bit more about what you want to work on?";
    const cancel = speakWhenReady(message);
    return () => {
      cancel();
      stopTTS();
    };
  }, [hasParsedHabits]);

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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-secondary px-6 text-center">
        <Icon icon="ic:round-info-outline" width={40} height={40} className="text-primary" />
        <h2 className="text-xl font-bold text-content">Tell me a bit more</h2>
        <p className="max-w-[280px] text-content-secondary">
          I didn&apos;t quite catch anything specific to turn into habits. Could you share what you
          want to work on — like &quot;sleep earlier&quot; or &quot;exercise three times a
          week&quot;?
        </p>
        <button
          type="button"
          onClick={() => navigate('/onboarding/advanced-input')}
          className="mt-2 rounded-full bg-primary px-6 py-3 font-semibold text-white"
        >
          Try Again
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
