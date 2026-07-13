import { GoalsListBeat } from '@/components/flow-designer/beats/goalsList';
import type { OnboardingBeat } from '@/generated/onboardingContract';
import { Surface } from './_shared';

export default function GoalsListPreview({
  beat,
  onAdvance,
}: {
  beat: OnboardingBeat;
  onAdvance: () => void;
}) {
  return (
    <Surface beat={beat}>
      <div
        data-testid="goals-list-preview-real"
        style={{ minHeight: 312, display: 'grid', alignItems: 'center' }}
      >
        <GoalsListBeat
          {...beat.component.config}
          {...(beat.component.props ?? {})}
          onAdvance={onAdvance}
        />
      </div>
    </Surface>
  );
}
