import { useState, useCallback } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { formatCadence } from '@/components/onboarding/constants';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import { useToast } from '@/contexts/ToastContext';
import { authClient } from '@/lib/auth-client';
import { getDataService } from '@/lib/services/service-provider';
import { supabase } from '@/lib/supabase';
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
  const { addToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleStartPlan = useCallback(async () => {
    if (!state?.habitConfigs) return;
    setIsSaving(true);

    try {
      const ds = await getDataService();

      // Create habits from the onboarding config
      const habitNames = Object.keys(state.habitConfigs);
      for (const name of habitNames) {
        try {
          await ds.createHabit(name, 'daily');
        } catch {
          // Ignore duplicate habit errors
        }
      }

      // Save onboarding state to Supabase
      const { data: session } = await authClient.getSession();
      const uid = session?.user?.id;
      if (uid) {
        const { error: obError } = await supabase.from('onboarding_states').upsert(
          {
            user_id: uid,
            path: state.source === 'advanced' ? 'advanced' : 'beginner',
            status: 'completed',
            current_step: state.source === 'advanced' ? 6 : 7,
            data: {
              habitConfigs: state.habitConfigs,
              goals: state.goals,
              category: state.category,
              reflectionConfig: state.reflectionConfig,
              source: state.source,
            },
            completed_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
        if (obError) console.error('[Onboarding] Failed to save state:', obError.message);
      }

      // Update display name from onboarding Step 1 nickname
      if (uid) {
        const { data: obState } = await supabase
          .from('onboarding_states')
          .select('data')
          .eq('user_id', uid)
          .maybeSingle();
        const nickname = obState?.data?.nickname;
        if (nickname) {
          await authClient.updateUser({ name: nickname }).catch(() => {});
        }
      }

      navigate('/home');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save onboarding plan';
      addToast('error', msg);
      navigate('/home');
    } finally {
      setIsSaving(false);
    }
  }, [state, navigate, addToast]);

  if (!state?.habitConfigs || !state?.reflectionConfig) {
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
      ctaLabel={isSaving ? 'Saving...' : 'Start plan'}
      onNext={handleStartPlan}
      ctaDisabled={isSaving}
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
