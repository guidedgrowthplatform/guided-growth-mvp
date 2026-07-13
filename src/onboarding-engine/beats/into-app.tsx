import { FullPlanBeat } from '@/components/flow-designer/beats/onboardingComplete';
import type { OnboardingBeat } from '@/generated/onboardingContract';
import { Surface } from './_shared';

export default function IntoAppPreview({
  beat,
  onAdvance,
}: {
  beat: OnboardingBeat;
  onAdvance: () => void;
}) {
  return (
    <Surface beat={beat}>
      <div
        data-testid="into-app-preview-real"
        style={{ minHeight: 312, display: 'grid', alignItems: 'center' }}
      >
        <FullPlanBeat
          {...beat.component.config}
          {...(beat.component.props ?? {})}
          onAdvance={onAdvance}
        />
      </div>
    </Surface>
  );
}
