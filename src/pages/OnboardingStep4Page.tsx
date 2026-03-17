import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';

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

export function OnboardingStep4Page() {
  const navigate = useNavigate();
  const location = useLocation();
  const category = (location.state as { category?: string })?.category ?? 'Sleep better';
  const goals = goalsByCategory[category] ?? goalsByCategory['Sleep better'];
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  return (
    <OnboardingLayout
      currentStep={4}
      totalSteps={7}
      ctaLabel="Continue"
      ctaVariant="inline"
      onNext={() => navigate('/home')}
      onBack={() => navigate('/onboarding/step-3')}
      showVoiceButton
      aiListeningPrompt='"Within that category, what specific area would you like to improve?"'
      ctaDisabled={selected.size === 0}
    >
      <OnboardingHeader
        title={`Let's narrow it down on your ${category} category`}
        subtitle="Choose 1 or 2 specific goals to shape your habits"
      />
      <div className="flex flex-col gap-[16px]">
        {goals.map((g) => (
          <GoalCard key={g} label={g} selected={selected.has(g)} onToggle={() => toggleGoal(g)} />
        ))}
      </div>
    </OnboardingLayout>
  );
}
