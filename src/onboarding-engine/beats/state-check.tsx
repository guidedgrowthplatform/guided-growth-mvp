import { CheckInCard } from '@/components/home/CheckInCard';
import type { OnboardingBeat } from '@/generated/onboardingContract';
import { Surface } from './_shared';

export default function StateCheckPreview({
  beat,
  onAdvance,
}: {
  beat: OnboardingBeat;
  onAdvance: () => void;
}) {
  return (
    <Surface beat={beat}>
      <div
        data-testid="state-check-preview-real"
        style={{ minHeight: 312, display: 'grid', alignItems: 'center' }}
      >
        <CheckInCard
          {...beat.component.config}
          {...(beat.component.props ?? {})}
          selectedDate="2026-07-13"
          onComplete={onAdvance}
        />
      </div>
    </Surface>
  );
}
