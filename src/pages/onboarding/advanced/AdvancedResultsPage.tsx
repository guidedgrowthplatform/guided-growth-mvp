import { Icon } from '@iconify/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { WEEKDAYS } from '@/components/onboarding/constants';
import { HabitSummaryCard } from '@/components/onboarding/HabitSummaryCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingAgent } from '@/hooks/useOnboardingAgent';
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

function buildInitialHabits(state: ResultsLocationState | null, fallbackText: string): HabitItem[] {
  if (state?.habits && state.habits.length > 0) {
    return state.habits.map((h) => ({
      name: h.name,
      days: new Set(h.days ?? WEEKDAYS),
      selected: true,
    }));
  }

  const sourceText = state?.text ?? fallbackText;
  if (sourceText) {
    const parsed = parseHabitsFromText(sourceText);
    if (parsed.length > 0) {
      return parsed.map((h) => ({
        name: h.name,
        days: new Set(WEEKDAYS),
        selected: true,
      }));
    }
  }

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
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const locationState = location.state as ResultsLocationState | null;
  const clearedRef = useRef(false);

  useOnboardingAgent('onboard_advanced_results');
  useAgentNavigation(4, '/onboarding/advanced-step-6');

  const fallbackBrainDump = onboardingState?.data?.brainDumpText ?? '';

  const baseHabits = useMemo(
    () => buildInitialHabits(locationState, fallbackBrainDump),
    [locationState, fallbackBrainDump],
  );
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

  // Fire view_ai_organized_plan once habits are loaded
  const hasTrackedView = useRef(false);
  useEffect(() => {
    if (hasTrackedView.current || habits.length === 0) return;
    hasTrackedView.current = true;
    track('view_ai_organized_plan', { habits_generated_count: habits.length });
  }, [habits.length]);

  const regenerateCountRef = useRef(0);

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
      <OnboardingLayout
        currentStep={4}
        ctaLabel="Looks Good!"
        onBack={() => navigate('/onboarding/advanced-input')}
        onNext={() => navigate('/onboarding/advanced-input')}
        showVoiceButton
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <Icon icon="ic:round-info-outline" width={40} height={40} className="text-primary" />
          <h2 className="text-xl font-bold text-content">Tell me a bit more</h2>
          <p className="max-w-[280px] text-content-secondary">
            I didn&apos;t quite catch anything specific to turn into habits. Could you share what
            you want to work on — like &quot;sleep earlier&quot; or &quot;exercise three times a
            week&quot;?
          </p>
        </div>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      currentStep={4}
      ctaLabel="Looks Good!"
      onBack={() => navigate('/onboarding/advanced-input')}
      onNext={handleConfirm}
      secondaryAction={{
        label: 'Regenerate',
        onClick: () => {
          regenerateCountRef.current += 1;
          track('tap_regenerate_plan', { regeneration_count: regenerateCountRef.current });
          navigate('/onboarding/advanced-input');
        },
      }}
      showVoiceButton
    >
      <OnboardingHeader
        title="We organized this for you"
        subtitle="Here is the cleanest place to start based on what you shared."
      />
      <div className="flex flex-col gap-[16px]">
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
    </OnboardingLayout>
  );
}
