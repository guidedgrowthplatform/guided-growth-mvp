import { useCallback } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { formatCadence } from '@/components/onboarding/constants';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import { useOnboarding } from '@/hooks/useOnboarding';
import { Sentry } from '@/lib/sentry';
const CATEGORY_ICONS: Record<string, string> = {
  Sleep: 'ic:outline-nightlight-round',
  Move: 'ic:outline-directions-run',
  Eat: 'ic:outline-restaurant',
  Energy: 'ic:outline-bolt',
  Stress: 'ic:outline-self-improvement',
  Focus: 'ic:outline-center-focus-strong',
  Habits: 'ic:outline-check-circle',
  Organization: 'ic:outline-assignment',
};

interface PlanReviewState {
  habitConfigs: Record<string, { days: number[]; time: string; reminder: boolean }>;
  goals?: string[];
  category?: string;
  reflectionConfig: { time: string; days: number[]; reminder: boolean; schedule: string };
  source?: 'advanced';
}

export function PlanReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as PlanReviewState | null;
  const { complete, isCompleting } = useOnboarding();

  const handleStartPlan = useCallback(() => {
    if (!state?.habitConfigs) return;
    complete({
      habitConfigs: state.habitConfigs,
      goals: state.goals,
      category: state.category,
      reflectionConfig: state.reflectionConfig,
    });
  }, [state, complete]);

  if (!state?.habitConfigs || !state?.reflectionConfig) {
    Sentry.captureMessage('PlanReviewPage: missing state — redirecting to /onboarding', {
      level: 'error',
      tags: { flow: 'onboarding', step: '7-planreview' },
      extra: {
        hasHabitConfigs: !!state?.habitConfigs,
        hasReflectionConfig: !!state?.reflectionConfig,
        hasState: !!state,
      },
    });
    return <Navigate to="/onboarding" replace />;
  }

  const { habitConfigs, goals, category, reflectionConfig, source } = state;
  const categoryIcon = category
    ? (CATEGORY_ICONS[category] ?? 'ic:outline-check-circle')
    : 'ic:outline-check-circle';
  const reflectionDays = new Set(reflectionConfig.days);

  return (
    <OnboardingLayout
      currentStep={source === 'advanced' ? 6 : 7}
      totalSteps={source === 'advanced' ? 6 : 7}
      ctaLabel={isCompleting ? 'Completing...' : 'Start plan'}
      onNext={handleStartPlan}
      ctaDisabled={isCompleting}
      onBack={() =>
        navigate(source === 'advanced' ? '/onboarding/advanced-step-6' : '/onboarding/step-6', {
          state:
            source === 'advanced'
              ? {
                  habitConfigs: Object.entries(habitConfigs).map(([name, c]) => ({
                    name,
                    days: c.days,
                  })),
                }
              : { habitConfigs, goals, category, reflectionConfig },
        })
      }
      secondaryAction={{
        label: 'Edit plan',
        onClick: () =>
          navigate(source === 'advanced' ? '/onboarding/advanced-results' : '/onboarding/step-5', {
            state:
              source === 'advanced'
                ? {}
                : { habitConfigs, goals, category, reflectionConfig, phase: 'confirming' },
          }),
      }}
      showVoiceButton
      voiceFileId="ONBOARD-07"
      voicePrompt="Here's your starting plan. It's simple — and that's on purpose. This is your foundation. As you show up, we'll grow it together. And from here on — it's easy. Morning check-in, evening check-in. Under a minute each. That's your whole commitment. Everything else happens naturally. Ready?"
    >
      <OnboardingHeader
        title="Your starting plan"
        subtitle="Here's what we've put together based on your goals. You can always adjust later."
      />

      <div className="flex flex-col gap-[12px]">
        {Object.entries(habitConfigs).map(([habit, config]) => (
          <PlanSummaryCard
            key={habit}
            icon={categoryIcon}
            typeLabel="Habit"
            title={habit}
            cadence={formatCadence(new Set(config.days))}
            rule={config.time ? `Reminder at ${config.time}` : 'No reminder set'}
            onEdit={() =>
              navigate(
                source === 'advanced' ? '/onboarding/advanced-results' : '/onboarding/step-5',
                {
                  state:
                    source === 'advanced'
                      ? {}
                      : { habitConfigs, goals, category, reflectionConfig, phase: 'confirming' },
                },
              )
            }
          />
        ))}

        <PlanSummaryCard
          icon="ic:outline-menu-book"
          typeLabel="Reflection"
          title="Daily reflection"
          cadence={formatCadence(reflectionDays)}
          rule={reflectionConfig.time ? `Reminder at ${reflectionConfig.time}` : 'No reminder set'}
        />
      </div>
    </OnboardingLayout>
  );
}
