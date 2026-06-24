import { SelectionCard } from '@/components/onboarding/SelectionCard';
import { useOnboarding } from '@/hooks/useOnboarding';
import type { OnboardingPath } from '@gg/shared/types';
import type { OnboardingCardApi } from './onboardingCardRegistry';

interface PathChoiceCardProps {
  data: { path?: OnboardingPath };
  api: OnboardingCardApi;
}

type DisplayPlan = 'simple' | 'braindump';

function coercePath(value: OnboardingPath | null | undefined): DisplayPlan | null {
  if (value === 'simple') return 'simple';
  if (value === 'braindump' || value === 'advanced') return 'braindump';
  return null;
}

export function PathChoiceCard({ data, api }: PathChoiceCardProps) {
  const { state } = useOnboarding();
  const livePath = coercePath(state?.data?.path);
  const seedPath = coercePath(data.path);
  const plan: DisplayPlan | null = livePath ?? seedPath;
  const frozen = (state?.current_step ?? 0) > 2;

  function pick(choice: DisplayPlan) {
    if (frozen) return;
    api.submitPathChoice?.(choice);
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <div
        className={`flex flex-col gap-3 ${frozen ? 'pointer-events-none' : ''}`}
        aria-disabled={frozen || undefined}
      >
        <SelectionCard
          icon="mdi:sparkles"
          title="I'm new to habit tracking"
          description="I'll help you step by step"
          selected={plan === 'simple'}
          onSelect={() => pick('simple')}
        />
        <SelectionCard
          icon="mdi:lightning-bolt"
          title="I already track habits"
          description="Tell me your habits and I'll organize them"
          selected={plan === 'braindump'}
          onSelect={() => pick('braindump')}
        />
      </div>
    </div>
  );
}
