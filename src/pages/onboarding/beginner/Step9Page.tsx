import { useCallback } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { formatCadence } from '@/components/onboarding/constants';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingRealtimeScreen } from '@/hooks/useOnboardingRealtimeScreen';
import { Sentry } from '@/lib/sentry';

/**
 * ONBOARD-09 — Final Plan + Founding User Moment.
 *
 * Per Yair spreadsheet: "Show the complete plan: morning check-in, habits,
 * evening check-in with reflection. Deliver the founding user message:
 * 'As one of the first 50 people to use Guided Growth...' User says
 * 'let's go' → complete_onboarding fires → Home."
 */

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

interface Step9State {
  habitConfigs: Record<string, { days: number[]; time: string; reminder: boolean }>;
  goals?: string[];
  category?: string;
  reflectionConfig?: { time: string; days: number[]; reminder: boolean; schedule: string };
  reflectionStyle?: 'guided' | 'custom' | 'freeform';
  journal_configured?: boolean;
}

export function Step9Page() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as Step9State | null;
  const { complete, isCompleting } = useOnboarding();

  const handleStartPlan = useCallback(() => {
    if (!state?.habitConfigs) return;
    complete({
      habitConfigs: state.habitConfigs,
      goals: state.goals,
      category: state.category,
      reflectionConfig: state.reflectionConfig,
      reflectionStyle: state.reflectionStyle,
    });
  }, [state, complete]);

  // Voice-driven: agent delivers founding user moment, user says "let's go"
  // → navigate_next fires → complete onboarding → home.
  useOnboardingRealtimeScreen({
    screen: 'onboard_09',
    onFieldCaptured: () => {},
    onNavigate: () => {
      if (!state?.habitConfigs) return;
      complete({
        habitConfigs: state.habitConfigs,
        goals: state.goals,
        category: state.category,
        reflectionConfig: state.reflectionConfig,
        reflectionStyle: state.reflectionStyle,
      });
    },
  });

  if (!state?.habitConfigs) {
    Sentry.captureMessage('Step9Page: missing state — redirecting to /onboarding', {
      level: 'error',
      tags: { flow: 'onboarding', step: '9-final' },
    });
    return <Navigate to="/onboarding" replace />;
  }

  const { habitConfigs, category, reflectionConfig } = state;
  const categoryIcon = category
    ? (CATEGORY_ICONS[category] ?? 'ic:outline-check-circle')
    : 'ic:outline-check-circle';
  const reflectionDays = new Set(reflectionConfig?.days ?? []);

  return (
    <OnboardingLayout
      currentStep={9}
      totalSteps={9}
      ctaLabel={isCompleting ? 'Starting...' : "Let's go!"}
      onNext={handleStartPlan}
      ctaDisabled={isCompleting}
      onBack={() => navigate('/onboarding/step-8', { state })}
    >
      <OnboardingHeader
        title="You're one of the first 50."
        subtitle="Here's your complete plan. Morning check-in, your habits, evening reflection. Ready?"
      />

      {/* Founding user callout */}
      <div className="rounded-2xl bg-primary/5 p-4">
        <p className="text-sm leading-relaxed text-content-secondary">
          As one of the first 50 people to use Guided Growth, you're helping shape what this
          becomes. Your feedback matters more than you know. Welcome aboard.
        </p>
      </div>

      <div className="flex flex-col gap-[12px]">
        {/* Morning check-in */}
        <PlanSummaryCard
          icon="ic:outline-wb-sunny"
          typeLabel="Check-in"
          title="Morning check-in"
          cadence="Every day"
          rule="Quick mood, sleep, energy, stress — under 1 minute"
        />

        {/* Habits */}
        {Object.entries(habitConfigs).map(([habit, config]) => (
          <PlanSummaryCard
            key={habit}
            icon={categoryIcon}
            typeLabel="Habit"
            title={habit}
            cadence={formatCadence(new Set(config.days))}
            rule={config.time ? `Reminder at ${config.time}` : 'No reminder set'}
          />
        ))}

        {/* Evening reflection */}
        <PlanSummaryCard
          icon="ic:outline-nightlight"
          typeLabel="Reflection"
          title={`Evening reflection (${state.reflectionStyle ?? 'guided'})`}
          cadence={reflectionDays.size > 0 ? formatCadence(reflectionDays) : 'Every day'}
          rule={reflectionConfig?.time ? `Reminder at ${reflectionConfig.time}` : 'No reminder set'}
        />
      </div>
    </OnboardingLayout>
  );
}
