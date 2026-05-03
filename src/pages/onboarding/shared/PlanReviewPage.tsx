import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { setUserProperty, track } from '@/analytics';
import { formatCadence } from '@/components/onboarding/constants';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingAgent } from '@/hooks/useOnboardingAgent';
import { markOnboardingStepStart, trackOnboardingStepComplete } from '@/lib/onboardingAnalytics';
import { Sentry } from '@/lib/sentry';
import { deriveStateFromOnboarding, type PlanReviewState } from './planReviewDerive';

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

export function PlanReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routerState = location.state as PlanReviewState | null;
  const { state: onboardingState, complete, isCompleting } = useOnboarding();

  useOnboardingAgent('onboard_07');

  // Router state carries source='advanced' that agent-driven derivation can't reconstruct.
  const state = useMemo<PlanReviewState | null>(
    () => routerState ?? deriveStateFromOnboarding(onboardingState?.data),
    [routerState, onboardingState?.data],
  );

  const onboardingPath =
    state?.source === 'advanced'
      ? 'advanced'
      : onboardingState?.path === 'braindump'
        ? 'advanced'
        : 'beginner';

  useEffect(() => {
    if (!state?.habitConfigs || !state?.reflectionConfig) return;
    markOnboardingStepStart('starting_plan');
    track('view_starting_plan', {
      total_habits: Object.keys(state.habitConfigs).length,
      has_journal: true,
      onboarding_path: onboardingPath,
    });
  }, [state, onboardingPath]);

  const handleStartPlan = useCallback(() => {
    if (!state?.habitConfigs) return;
    window.sessionStorage.setItem('gg_onboarding_completion_in_flight', '1');
    const onboardingStartedAt = Number.parseInt(
      window.sessionStorage.getItem('gg_onboarding_started_at') ?? '',
      10,
    );
    const totalTimeSeconds =
      Number.isFinite(onboardingStartedAt) && onboardingStartedAt > 0
        ? Math.round((Date.now() - onboardingStartedAt) / 1000)
        : undefined;
    trackOnboardingStepComplete({
      stepKey: 'starting_plan',
      stepNumber: state.source === 'advanced' ? 6 : 7,
      stepName: 'starting_plan',
      onboardingPath,
    });
    track('complete_onboarding', {
      onboarding_path: onboardingPath,
      total_habits: Object.keys(state.habitConfigs).length,
      has_journal: Boolean(state.reflectionConfig),
      total_time_seconds: totalTimeSeconds,
      steps_completed: state.source === 'advanced' ? 6 : 7,
    });
    setUserProperty({
      onboarding_path: onboardingPath,
      active_habits_count: Object.keys(state.habitConfigs).length,
      journaling_enabled: Boolean(state.reflectionConfig),
    });
    window.sessionStorage.removeItem('gg_onboarding_started_at');
    window.sessionStorage.removeItem('gg_onboarding_started_tracked');
    window.sessionStorage.removeItem('gg_onboarding_path');
    complete({
      habitConfigs: state.habitConfigs,
      goals: state.goals,
      category: state.category,
      reflectionConfig: state.reflectionConfig,
    });
  }, [state, complete, onboardingPath]);

  // Voice "let's go" mirrors the tap flow once the agent bumps current_step past 7.
  const autoCompletedRef = useRef(false);
  useEffect(() => {
    if (autoCompletedRef.current) return;
    if (isCompleting) return;
    if (!state?.habitConfigs || !state?.reflectionConfig) return;
    if (!onboardingState) return;
    if (onboardingState.current_step <= 7) return;
    autoCompletedRef.current = true;
    handleStartPlan();
  }, [onboardingState, state, isCompleting, handleStartPlan]);

  if (!state?.habitConfigs || !state?.reflectionConfig) {
    Sentry.captureMessage('PlanReviewPage: missing state — redirecting to /onboarding', {
      level: 'error',
      tags: { flow: 'onboarding', step: '7-planreview' },
      extra: {
        hasRouterState: !!routerState,
        hasOnboardingData: !!onboardingState?.data,
        hasHabitConfigs: !!state?.habitConfigs,
        hasReflectionConfig: !!state?.reflectionConfig,
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
      showVoiceButton
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
          typeLabel="Journal"
          title="Daily reflection"
          cadence={formatCadence(reflectionDays)}
          rule={reflectionConfig.time ? `Reminder at ${reflectionConfig.time}` : 'No reminder set'}
        />
      </div>
    </OnboardingLayout>
  );
}
