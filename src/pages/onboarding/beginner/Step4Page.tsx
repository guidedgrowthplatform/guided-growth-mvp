import { Icon } from '@iconify/react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { useOnboarding } from '@/hooks/useOnboarding';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';

const goalsByCategory: Record<string, string[]> = {
  'Sleep better': [
    'Fall asleep earlier',
    'Wake up earlier',
    'Sleep more consistently',
    'Sleep more deeply',
  ],
  'Move more': ['Exercise regularly', 'Walk more daily', 'Try a new sport', 'Stretch daily'],
  'Eat better': [
    'Eat more vegetables',
    'Cook at home more',
    'Reduce sugar intake',
    'Drink more water',
  ],
  'Feel more energized': [
    'Improve morning routine',
    'Take fewer naps',
    'Manage caffeine intake',
    'Get more sunlight',
  ],
  'Reduce stress': [
    'Meditate regularly',
    'Practice breathing',
    'Set boundaries',
    'Spend time in nature',
  ],
  'Improve focus': [
    'Reduce screen time',
    'Use time blocks',
    'Limit multitasking',
    'Take regular breaks',
  ],
  'Break bad habits': [
    'Stop procrastinating',
    'Reduce social media',
    'Quit snacking late',
    'Stop oversleeping',
  ],
  'Get more organized': [
    'Plan weekly',
    'Declutter spaces',
    'Use a to-do list',
    'Set daily priorities',
  ],
};

export function Step4Page() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const category = (location.state as { category?: string })?.category ?? 'Sleep better';
  const goals = goalsByCategory[category] ?? goalsByCategory['Sleep better'];
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (onboardingState?.data?.goals && Array.isArray(onboardingState.data.goals)) {
      setSelected(new Set(onboardingState.data.goals as string[]));
    }
  }, [onboardingState?.data?.goals]);

  function toggleGoal(goal: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(goal)) {
        next.delete(goal);
      } else if (next.size < 2) {
        next.add(goal);
      }
      return next;
    });
  }

  const handleVoiceAction = useCallback(
    (result: OnboardingVoiceResult) => {
      if (result.params && Array.isArray(result.params.goals)) {
        const voiceGoals = result.params.goals as string[];
        const newSelected = new Set<string>();
        voiceGoals.forEach((g) => {
          if (goals.includes(g)) {
            newSelected.add(g);
          }
        });
        setSelected(newSelected);
      }
    },
    [goals],
  );

  const handleNext = useCallback(async () => {
    await saveStepAsync(4, { goals: Array.from(selected) });
    navigate('/onboarding/step-5', { state: { goals: Array.from(selected), category } });
  }, [selected, category, navigate, saveStepAsync]);

  return (
    <OnboardingLayout
      currentStep={4}
      totalSteps={7}
      ctaLabel="Continue"
      ctaVariant="inline"
      onNext={handleNext}
      onBack={() => navigate('/onboarding/step-3')}
      showVoiceButton
      aiListeningPrompt='"Within that category, what specific area would you like to improve?"'
      ctaDisabled={selected.size === 0}
      voiceOptions={goals}
      voicePrompt="Got it! Within that category, what specific area would you like to improve? For example, sleep, exercise, or diet?"
      onVoiceAction={handleVoiceAction}
    >
      <OnboardingHeader
        title="Let's narrow it down"
        subtitle={`Choose 1 or 2 specific goals to help you ${category.toLowerCase()}`}
      />
      <div className="inline-flex items-center gap-1 rounded-[10px] bg-[#0a2540] px-2 py-1">
        <Icon icon="iconamoon:category" width={24} height={24} className="text-white" />
        <span className="text-[16px] font-bold leading-[24px] text-white">Category:</span>
        <span className="text-[16px] font-bold leading-[24px] text-white">{category}</span>
      </div>
      <div className="flex flex-col gap-[16px]">
        {goals.map((g) => (
          <GoalCard
            key={g}
            label={g}
            selected={selected.has(g)}
            disabled={!selected.has(g) && selected.size >= 2}
            onToggle={() => toggleGoal(g)}
          />
        ))}
      </div>
    </OnboardingLayout>
  );
}
