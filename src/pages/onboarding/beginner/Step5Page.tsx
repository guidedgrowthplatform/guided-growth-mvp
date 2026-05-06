import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HabitCustomizeSheet, type HabitConfig } from '@/components/onboarding/HabitCustomizeSheet';
import { HabitPickerPanel } from '@/components/onboarding/HabitPickerPanel';
import { HabitSummaryCard } from '@/components/onboarding/HabitSummaryCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingTooltip } from '@/components/onboarding/OnboardingTooltip';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { habitsByGoal } from '@/data/onboardingHabits';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingAgent } from '@/hooks/useOnboardingAgent';

export function Step5Page() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const state = location.state as {
    goals?: string[];
    category?: string;
    habitConfigs?: Record<
      string,
      { days: number[] | Set<number>; time: string; reminder: boolean; schedule?: string }
    >;
    phase?: 'confirming';
    reflectionConfig?: { time: string; days: number[]; reminder: boolean; schedule: string };
  } | null;
  const goals = useMemo(
    () => (state?.goals?.length ? state.goals : ['Fall asleep earlier']),
    [state],
  );

  useOnboardingAgent('onboard_05');

  useAgentNavigation(5, '/onboarding/step-6');

  // Reconstitute Sets from arrays after router state serialization
  const incomingConfigs: Record<string, HabitConfig> | undefined = state?.habitConfigs
    ? Object.fromEntries(
        Object.entries(state.habitConfigs).map(([k, v]) => [
          k,
          {
            ...v,
            days: v.days instanceof Set ? v.days : new Set(v.days),
            schedule: (v.schedule ?? 'Weekday') as HabitConfig['schedule'],
          },
        ]),
      )
    : undefined;

  const [customHabits, setCustomHabits] = useState<Record<string, string[]>>({});
  const [expandedGoal, setExpandedGoal] = useState<string>(goals[0]);
  const [selectedHabits, setSelectedHabits] = useState<Set<string>>(() =>
    incomingConfigs ? new Set(Object.keys(incomingConfigs)) : new Set(),
  );
  const [habitConfigs, setHabitConfigs] = useState<Record<string, HabitConfig>>(
    () => incomingConfigs ?? {},
  );
  const [customizingHabit, setCustomizingHabit] = useState<string | null>(null);
  const [habitQueue, setHabitQueue] = useState<string[]>([]);
  const [phase, setPhase] = useState<'selecting' | 'confirming'>(
    state?.phase === 'confirming' && incomingConfigs ? 'confirming' : 'selecting',
  );

  useEffect(() => {
    if (onboardingState?.data?.habitConfigs) {
      const savedConfigs = onboardingState.data.habitConfigs as Record<
        string,
        { days: number[] | Set<number>; time: string; reminder: boolean }
      >;
      const reconstituted: Record<string, HabitConfig> = Object.fromEntries(
        Object.entries(savedConfigs).map(([k, v]) => [
          k,
          {
            ...v,
            days: v.days instanceof Set ? v.days : new Set(v.days),
            schedule: ((v as { schedule?: string }).schedule ??
              'Weekday') as HabitConfig['schedule'],
          },
        ]),
      );
      setHabitConfigs(reconstituted);
      setSelectedHabits(new Set(Object.keys(reconstituted)));
      setPhase('confirming');
    }
  }, [onboardingState?.data?.habitConfigs]);

  function toggleHabit(habit: string) {
    if (selectedHabits.has(habit)) {
      const next = new Set(selectedHabits);
      next.delete(habit);
      setSelectedHabits(next);
      setHabitConfigs((c) => {
        const updated = { ...c };
        delete updated[habit];
        return updated;
      });
      return;
    }
    if (selectedHabits.size >= 2) return;
    const next = new Set(selectedHabits);
    next.add(habit);
    setSelectedHabits(next);
  }

  function addCustomHabit(goal: string, habit: string) {
    if (selectedHabits.size >= 2) return;
    setCustomHabits((prev) => ({
      ...prev,
      [goal]: [...(prev[goal] ?? []), habit],
    }));
    const next = new Set(selectedHabits);
    next.add(habit);
    setSelectedHabits(next);
  }

  const handleContinue = useCallback(() => {
    const queue = [...selectedHabits];
    setHabitQueue(queue);
    setCustomizingHabit(queue[0]);
  }, [selectedHabits]);

  function handleSheetClose() {
    setCustomizingHabit(null);
    setHabitQueue([]);
  }

  function handleSheetNext(config: HabitConfig) {
    if (!customizingHabit) return;

    const currentIdx = habitQueue.indexOf(customizingHabit);
    const nextIdx = currentIdx + 1;

    setHabitConfigs((prev) => ({ ...prev, [customizingHabit]: config }));

    if (nextIdx < habitQueue.length) {
      setCustomizingHabit(habitQueue[nextIdx]);
    } else {
      setCustomizingHabit(null);
      setHabitQueue([]);
      setPhase('confirming');
    }
  }

  function handleEditHabit(habit: string) {
    setHabitQueue([habit]);
    setCustomizingHabit(habit);
  }

  const isLastHabit = customizingHabit
    ? habitQueue.indexOf(customizingHabit) === habitQueue.length - 1
    : true;

  const handleOnNext = useCallback(async () => {
    if (phase === 'confirming') {
      const serializedConfigs = Object.fromEntries(
        Object.entries(habitConfigs).map(([k, v]) => [k, { ...v, days: [...v.days] }]),
      );
      await saveStepAsync(5, { habitConfigs: serializedConfigs });
      navigate('/onboarding/step-6', {
        state: {
          habitConfigs: serializedConfigs,
          goals,
          category: state?.category,
          reflectionConfig: state?.reflectionConfig,
        },
      });
    } else {
      handleContinue();
    }
  }, [phase, habitConfigs, goals, state, navigate, handleContinue, saveStepAsync]);

  return (
    <>
      <OnboardingLayout
        currentStep={5}
        ctaLabel={phase === 'confirming' ? 'Confirm & Continue' : 'Continue'}
        ctaVariant="inline"
        onNext={handleOnNext}
        onBack={
          phase === 'confirming'
            ? () => setPhase('selecting')
            : () => navigate('/onboarding/step-4')
        }
        ctaDisabled={phase === 'selecting' && selectedHabits.size === 0}
        showVoiceButton
        aiListeningPrompt='"Select up to 2 daily habits to build your foundation."'
      >
        <OnboardingHeader
          title="Here's a good place to start"
          subtitle="Select up to 2 daily habits to build your foundation."
        />

        {phase === 'selecting' ? (
          <div className="flex flex-col gap-[16px]">
            {goals.map((goal) => (
              <HabitPickerPanel
                key={goal}
                goal={goal}
                habits={[...(habitsByGoal[goal] ?? []), ...(customHabits[goal] ?? [])]}
                expanded={expandedGoal === goal}
                onToggleExpanded={() => setExpandedGoal((prev) => (prev === goal ? '' : goal))}
                selectedHabits={selectedHabits}
                maxReached={selectedHabits.size >= 2}
                onToggleHabit={toggleHabit}
                onAddCustomHabit={(habit) => addCustomHabit(goal, habit)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-[16px]">
            {Object.entries(habitConfigs).map(([habit, config]) => (
              <HabitSummaryCard
                key={habit}
                habitName={habit}
                selectedDays={config.days}
                onEdit={() => handleEditHabit(habit)}
              />
            ))}
            <OnboardingTooltip
              title="Quick tip"
              message="You can use the edit function to change the results of the habits you want to have!"
            />
          </div>
        )}
      </OnboardingLayout>

      {customizingHabit && (
        <BottomSheet onClose={handleSheetClose}>
          <HabitCustomizeSheet
            key={customizingHabit}
            habitName={customizingHabit}
            onClose={handleSheetClose}
            onNext={handleSheetNext}
            isLastHabit={isLastHabit}
          />
        </BottomSheet>
      )}
    </>
  );
}
