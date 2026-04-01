import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HabitCustomizeSheet, type HabitConfig } from '@/components/onboarding/HabitCustomizeSheet';
import { HabitPickerPanel } from '@/components/onboarding/HabitPickerPanel';
import { HabitSummaryCard } from '@/components/onboarding/HabitSummaryCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingTooltip } from '@/components/onboarding/OnboardingTooltip';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useOnboarding } from '@/hooks/useOnboarding';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';

const habitsByGoal: Record<string, string[]> = {
  'Fall asleep earlier': [
    'No screens after 10 PM',
    'No caffeine after 2 PM',
    'Start wind-down by 10 PM',
    'Be in bed by target bedtime',
    'No snooze',
    'No food after 9 PM',
  ],
  'Wake up earlier': [
    'Set alarm 15 min earlier',
    'No snooze',
    'Put alarm across room',
    'Sleep by 11 PM',
    'Morning sunlight 10 min',
  ],
  'Sleep more consistently': [
    'Same bedtime daily',
    'Same wake time daily',
    'No weekend sleep-ins',
    'Track sleep hours',
    'Wind-down routine',
  ],
  'Sleep more deeply': [
    'No screens 1hr before bed',
    'Cool room temperature',
    'No late caffeine',
    'Dark room setup',
    'White noise or silence',
  ],
  'Exercise regularly': [
    '30 min workout 3x/week',
    'Morning stretch routine',
    'Walk 10k steps',
    'Try a new class',
    'Active rest days',
  ],
  'Walk more daily': [
    '10k steps goal',
    'Walk after meals',
    'Take stairs',
    'Walking meetings',
    'Park farther away',
  ],
  'Try a new sport': [
    'Research one sport',
    'Watch a tutorial',
    'Book a trial class',
    'Find a buddy',
    'Set weekly practice',
  ],
  'Stretch daily': [
    'Morning stretch 10 min',
    'Post-workout stretch',
    'Desk stretch breaks',
    'Evening yoga',
    'Hip opener routine',
  ],
  'Eat more vegetables': [
    'Add veggies to every meal',
    'Try one new veggie weekly',
    'Prep veggies Sunday',
    'Green smoothie daily',
    'Salad for lunch',
  ],
  'Cook at home more': [
    'Meal prep Sunday',
    'Try 2 new recipes weekly',
    'Pack lunch daily',
    'Grocery list routine',
    'No delivery 5 days',
  ],
  'Reduce sugar intake': [
    'No sugary drinks',
    'Read nutrition labels',
    'Replace with fruit',
    'No dessert on weekdays',
    'Track sugar daily',
  ],
  'Drink more water': [
    '8 glasses daily',
    'Water before coffee',
    'Carry a bottle',
    'Drink before each meal',
    'Herbal tea evenings',
  ],
  'Improve morning routine': [
    'Wake at same time',
    'No phone first 30 min',
    'Morning journaling',
    'Healthy breakfast',
    'Plan the day',
  ],
  'Take fewer naps': [
    'No naps after 3 PM',
    'Limit to 20 min',
    'Walk instead of nap',
    'Caffeine cutoff noon',
    'Stay active afternoon',
  ],
  'Manage caffeine intake': [
    'No coffee after 2 PM',
    'Max 2 cups daily',
    'Switch to tea',
    'Track intake',
    'Caffeine-free weekends',
  ],
  'Get more sunlight': [
    'Morning walk 15 min',
    'Eat lunch outside',
    'Open blinds first thing',
    'Afternoon break outside',
    'Weekend outdoor time',
  ],
  'Meditate regularly': [
    '5 min morning meditation',
    'Guided session daily',
    'Breathing before bed',
    'Body scan weekly',
    'Mindful walk',
  ],
  'Practice breathing': [
    'Box breathing 3x daily',
    '4-7-8 before sleep',
    'Deep breaths at stress',
    'Morning breathwork',
    'Wim Hof method',
  ],
  'Set boundaries': [
    'Say no once daily',
    'Define work hours',
    'Phone-free dinner',
    'Weekly digital detox',
    'Communicate needs',
  ],
  'Spend time in nature': [
    'Daily park walk',
    'Weekend hike',
    'Garden 15 min',
    'Eat outside',
    'Nature journaling',
  ],
  'Reduce screen time': [
    'Screen time limit 2hr',
    'No phone in bedroom',
    'App timer alerts',
    'Read instead of scroll',
    'Phone-free mornings',
  ],
  'Use time blocks': [
    'Plan 3 blocks daily',
    '90 min focus sessions',
    'Batch similar tasks',
    'Calendar blocking',
    'Review blocks nightly',
  ],
  'Limit multitasking': [
    'One task at a time',
    'Close extra tabs',
    'Single app focus',
    'Complete then switch',
    'Pomodoro technique',
  ],
  'Take regular breaks': [
    '5 min break every hour',
    'Stand and stretch',
    'Eye rest 20-20-20',
    'Walk break at lunch',
    'Breathe between tasks',
  ],
  'Stop procrastinating': [
    '2-minute rule',
    'Start smallest task',
    'Set daily top 3',
    'Time block hard tasks',
    'Accountability partner',
  ],
  'Reduce social media': [
    '30 min daily limit',
    'No morning scroll',
    'Unfollow triggers',
    'App usage timer',
    'Replace with reading',
  ],
  'Quit snacking late': [
    'No food after 8 PM',
    'Brush teeth early',
    'Herbal tea instead',
    'Prep healthy snacks',
    'Drink water first',
  ],
  'Stop oversleeping': [
    'Alarm across room',
    'Same wake time daily',
    'Morning light exposure',
    'No weekend sleep-ins',
    'Accountability buddy',
  ],
  'Plan weekly': [
    'Sunday planning session',
    'Set 3 weekly goals',
    'Review Friday',
    'Meal plan ahead',
    'Schedule self-care',
  ],
  'Declutter spaces': [
    '10 min daily tidy',
    'One area per week',
    'Donate unused items',
    'Clear desk nightly',
    'Inbox zero daily',
  ],
  'Use a to-do list': [
    'Write 3 priorities daily',
    'Check off by EOD',
    'Weekly review',
    'Digital or paper system',
    'Plan night before',
  ],
  'Set daily priorities': [
    'Top 3 tasks morning',
    'Eat the frog first',
    'Time block priorities',
    'Say no to low-value',
    'Evening reflection',
  ],
};

export function Step5Page() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const state = location.state as {
    goals?: string[];
    category?: string;
    habitConfigs?: Record<
      string,
      { days: number[] | Set<number>; time: string; reminder: boolean }
    >;
    phase?: 'confirming';
    reflectionConfig?: { time: string; days: number[]; reminder: boolean; schedule: string };
  } | null;
  const goals = useMemo(
    () => (state?.goals?.length ? state.goals : ['Fall asleep earlier']),
    [state],
  );

  // Reconstitute Sets from arrays after router state serialization
  const incomingConfigs = state?.habitConfigs
    ? Object.fromEntries(
        Object.entries(state.habitConfigs).map(([k, v]) => [
          k,
          { ...v, days: v.days instanceof Set ? v.days : new Set(v.days) },
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
      const reconstituted = Object.fromEntries(
        Object.entries(savedConfigs).map(([k, v]) => [
          k,
          { ...v, days: v.days instanceof Set ? v.days : new Set(v.days) },
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

  // Collect all available habits for this phase
  const allHabits = goals.flatMap((goal) => [
    ...(habitsByGoal[goal] ?? []),
    ...(customHabits[goal] ?? []),
  ]);

  const handleVoiceAction = useCallback(
    (result: OnboardingVoiceResult) => {
      if (result.params && Array.isArray(result.params.habits)) {
        const voiceHabits = result.params.habits as string[];
        const newSelected = new Set<string>();
        voiceHabits.forEach((h) => {
          if (allHabits.includes(h) && newSelected.size < 2) {
            newSelected.add(h);
          }
        });
        setSelectedHabits(newSelected);
      }
    },
    [allHabits],
  );

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
    <OnboardingLayout
      currentStep={5}
      totalSteps={7}
      ctaLabel={phase === 'confirming' ? 'Confirm & Continue' : 'Continue'}
      ctaVariant="inline"
      onNext={handleOnNext}
      onBack={
        phase === 'confirming' ? () => setPhase('selecting') : () => navigate('/onboarding/step-4')
      }
      showVoiceButton
      aiListeningPrompt='"Select up to 2 daily habits to build your foundation."'
      ctaDisabled={phase === 'selecting' && selectedHabits.size === 0}
      voiceOptions={allHabits}
      voicePrompt="Here are a few great habits for that. Which one sounds good to you? You can pick from the list, or just tell me your own idea."
      onVoiceAction={handleVoiceAction}
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
    </OnboardingLayout>
  );
}
