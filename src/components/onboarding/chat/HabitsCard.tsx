import { useState } from 'react';
import { track } from '@/analytics/posthog';
import { HabitCustomizeSheet, type HabitConfig } from '@/components/onboarding/HabitCustomizeSheet';
import { HabitPickerPanel } from '@/components/onboarding/HabitPickerPanel';
import { HabitSummaryCard } from '@/components/onboarding/HabitSummaryCard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { habitsByGoal, MAX_HABITS_ONBOARDING } from '@/data/onboardingHabits';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useSessionLog } from '@/hooks/useSessionLog';
import type { SerializedHabitConfig } from '@/lib/onboarding/onboardingChatTypes';
import type { OnboardingCardApi } from './onboardingCardRegistry';

interface HabitsCardProps {
  data: { goals?: string[]; habitConfigs?: Record<string, SerializedHabitConfig> };
  api: OnboardingCardApi;
}

function reconstitute(
  configs?: Record<string, SerializedHabitConfig>,
): Record<string, HabitConfig> | undefined {
  if (!configs || Object.keys(configs).length === 0) return undefined;
  return Object.fromEntries(
    Object.entries(configs).map(([k, v]) => [
      k,
      {
        ...v,
        days: new Set(v.days),
        schedule: (v.schedule ?? 'Weekday') as HabitConfig['schedule'],
      },
    ]),
  );
}

// Beat 5 (beginner) — pick up to 2 habits, customize each in a bottom sheet,
// then confirm (Step5Page's selecting → sheet → confirming flow, minus voice
// and route nav).
export function HabitsCard({ data, api }: HabitsCardProps) {
  const { state } = useOnboarding();
  const { logEvent } = useSessionLog();
  // Read goals from LIVE state (not the frozen seed) so a coach-captured goal
  // set landing after render populates the picker instead of leaving it empty.
  const goals = (state?.data?.goals as string[] | undefined) ?? data.goals ?? [];
  const incoming = reconstitute(data.habitConfigs);

  const [customHabits, setCustomHabits] = useState<Record<string, string[]>>({});
  const [expandedGoal, setExpandedGoal] = useState<string>(goals[0] ?? '');
  const [selectedHabits, setSelectedHabits] = useState<Set<string>>(() =>
    incoming ? new Set(Object.keys(incoming)) : new Set(),
  );
  const [habitConfigs, setHabitConfigs] = useState<Record<string, HabitConfig>>(
    () => incoming ?? {},
  );
  const [customizingHabit, setCustomizingHabit] = useState<string | null>(null);
  const [habitQueue, setHabitQueue] = useState<string[]>([]);
  const [phase, setPhase] = useState<'selecting' | 'confirming'>(
    incoming ? 'confirming' : 'selecting',
  );

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
    if (selectedHabits.size >= MAX_HABITS_ONBOARDING) return;
    const next = new Set(selectedHabits);
    next.add(habit);
    setSelectedHabits(next);
  }

  function addCustomHabit(goal: string, habit: string) {
    if (selectedHabits.size >= MAX_HABITS_ONBOARDING) return;
    if (selectedHabits.has(habit)) return;
    setCustomHabits((prev) => ({ ...prev, [goal]: [...(prev[goal] ?? []), habit] }));
    const next = new Set(selectedHabits);
    next.add(habit);
    setSelectedHabits(next);

    // Mirror Step5Page: spec-canonical analytics + a habit_added session_log
    // event so the coach's state-delta knows a custom habit was added.
    track('create_habit', {
      habit_name: habit,
      source: 'onboarding',
      input_method: 'manual',
      is_suggested: false,
    });
    logEvent('habit_added', { name: habit, source: 'onboarding_custom' }, 'ONBOARD-BEGINNER-03');
  }

  function handleContinue() {
    const queue = [...selectedHabits];
    setHabitQueue(queue);
    setCustomizingHabit(queue[0]);
  }

  function handleSheetClose() {
    setCustomizingHabit(null);
    setHabitQueue([]);
  }

  function handleSheetNext(config: HabitConfig) {
    if (!customizingHabit) return;
    const nextIdx = habitQueue.indexOf(customizingHabit) + 1;
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

  function handleSubmit() {
    const serialized: Record<string, SerializedHabitConfig> = Object.fromEntries(
      Object.entries(habitConfigs).map(([k, v]) => [k, { ...v, days: [...v.days] }]),
    );
    api.submitHabits?.(serialized);
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      {phase === 'selecting' ? (
        <>
          <div className="flex flex-col gap-3">
            {goals.map((goal) => (
              <HabitPickerPanel
                key={goal}
                goal={goal}
                habits={[...(habitsByGoal[goal] ?? []), ...(customHabits[goal] ?? [])]}
                expanded={expandedGoal === goal}
                onToggleExpanded={() => setExpandedGoal((prev) => (prev === goal ? '' : goal))}
                selectedHabits={selectedHabits}
                maxReached={selectedHabits.size >= MAX_HABITS_ONBOARDING}
                onToggleHabit={toggleHabit}
                onAddCustomHabit={(habit) => addCustomHabit(goal, habit)}
              />
            ))}
          </div>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleContinue}
            disabled={selectedHabits.size === 0}
          >
            Continue
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {Object.entries(habitConfigs).map(([habit, config]) => (
              <HabitSummaryCard
                key={habit}
                habitName={habit}
                selectedDays={config.days}
                onEdit={() => handleEditHabit(habit)}
                showEditIcon
              />
            ))}
          </div>
          <Button variant="primary" size="lg" fullWidth onClick={handleSubmit} loading={api.busy}>
            Looks good
          </Button>
        </>
      )}

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
    </div>
  );
}
