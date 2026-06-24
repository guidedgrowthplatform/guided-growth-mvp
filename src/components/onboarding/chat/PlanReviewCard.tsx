import { formatCadence } from '@/components/onboarding/constants';
import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import { Button } from '@/components/ui/Button';
import { useOnboarding } from '@/hooks/useOnboarding';
import { deriveStateFromOnboarding } from '@/pages/onboarding/shared/planReviewDerive';
import type { OnboardingCardApi } from './onboardingCardRegistry';

// Beat 7 — plan review. Display-only summary of the derived plan (read live so
// late voice edits show), plus a "Start plan" button that finalizes onboarding
// (PlanReviewPage's tap path). Both onboarding paths persist under habitConfigs.
export function PlanReviewCard({ api }: { api: OnboardingCardApi }) {
  const { state } = useOnboarding();
  const plan = deriveStateFromOnboarding(state?.data);
  if (!plan?.habitConfigs || !plan?.reflectionConfig) return null;

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      {Object.entries(plan.habitConfigs).map(([habit, config]) => (
        <PlanSummaryCard
          key={habit}
          icon="ic:outline-check-circle"
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
        cadence={formatCadence(new Set(plan.reflectionConfig.days))}
        rule={
          plan.reflectionConfig.time
            ? `Reminder at ${plan.reflectionConfig.time}`
            : 'No reminder set'
        }
      />
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={() => api.confirmPlan?.()}
        loading={api.completing}
      >
        Start plan
      </Button>
    </div>
  );
}
