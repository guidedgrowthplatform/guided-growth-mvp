import { Icon } from '@iconify/react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { track } from '@/analytics';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { type OnboardingVoiceResult } from '@/contexts/useOnboardingVoiceSession';
import { goalsByCategory } from '@/data/onboardingHabits';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingFormSnapshot } from '@/hooks/useOnboardingFormSnapshot';
import { useCtaLoading } from '../shared/useCtaLoading';
import { useStepTiming } from '../shared/useStepTiming';

export function Step4Page() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  // Two paths land users on this page: the manual Continue button passes
  // `category` via React Router location.state, and voice auto-nav uses
  // bare `navigate(path)` with no state. Prefer the persisted value from
  // onboarding_states (always populated by submit_category before the
  // user gets here either way) so both paths render the right subcategory.
  const persistedCategory = onboardingState?.data?.category as string | undefined;
  const stateCategory = (location.state as { category?: string })?.category;
  const category = persistedCategory ?? stateCategory ?? 'Sleep better';
  const goals = goalsByCategory[category] ?? goalsByCategory['Sleep better'];
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ONBOARD-04 → step-5 on agent advance.
  useAgentNavigation(4, '/onboarding/step-5');
  const trackStepComplete = useStepTiming(6, 'specific_goals', 'beginner');

  useEffect(() => {
    const saved = onboardingState?.data?.goals;
    if (!Array.isArray(saved)) return;
    const allowed = new Set(goals);
    const valid = saved.filter((g): g is string => typeof g === 'string' && allowed.has(g));
    setSelected(new Set(valid));
  }, [onboardingState?.data?.goals, goals]);

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

  const snapshot = useOnboardingFormSnapshot({
    goals: selected.size > 0 ? Array.from(selected) : undefined,
    category,
  });

  const handleVoiceAction = useCallback(
    (result: OnboardingVoiceResult) => {
      if (result.action !== 'select_multiple') return;
      const params = result.params as { fieldName?: string; values?: unknown };
      if (params.fieldName !== 'goals' || !Array.isArray(params.values)) return;
      const allowed = new Set(goals);
      const filtered = params.values
        .filter((v): v is string => typeof v === 'string')
        .filter((v) => allowed.has(v))
        .slice(0, 2);
      if (filtered.length > 0) setSelected(new Set(filtered));
    },
    [goals],
  );

  const handleNext = useCallback(async () => {
    if (selected.size === 0) return;
    await saveStepAsync(4, { goals: Array.from(selected) });
    track('select_specific_goals', {
      category,
      goals: Array.from(selected),
    });
    trackStepComplete();
    navigate('/onboarding/step-5', { state: { goals: Array.from(selected), category } });
  }, [selected, category, navigate, saveStepAsync, trackStepComplete]);

  const { loading: ctaLoading, run: handleNextCta } = useCtaLoading(handleNext);

  return (
    <OnboardingLayout
      screenId="ONBOARD-BEGINNER-02"
      formSnapshot={snapshot}
      ctaLabel="Continue"
      ctaVariant="inline"
      onNext={handleNextCta}
      onBack={() => navigate('/onboarding/step-3')}
      ctaDisabled={selected.size === 0}
      ctaLoading={ctaLoading}
      showVoiceButton
      aiListeningPrompt='"Within that category, what specific area would you like to improve?"'
      onVoiceAction={handleVoiceAction}
    >
      <OnboardingHeader
        title="Let's narrow it down"
        subtitle={`Choose 1 or 2 specific areas to help you ${category.toLowerCase()}`}
      />
      <div className="inline-flex items-center gap-1 rounded-[10px] bg-surface px-2 py-1">
        <Icon icon="iconamoon:category" width={24} height={24} className="text-content" />
        <span className="text-[16px] font-bold leading-[24px] text-content">Category:</span>
        <span className="text-[16px] font-bold leading-[24px] text-content">{category}</span>
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
