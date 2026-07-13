import { GetStarted } from '@/components/flow-designer/beats/getStarted';
import type { OnboardingBeat } from '@/generated/onboardingContract';
import { Surface } from './_shared';

export default function GetStartedPreview({
  beat,
  onAdvance,
}: {
  beat: OnboardingBeat;
  onAdvance: () => void;
}) {
  return (
    <Surface beat={beat}>
      <div
        data-testid="get-started-preview-real"
        style={{ minHeight: 312, display: 'grid', alignItems: 'center' }}
      >
        <GetStarted
          {...beat.component.config}
          {...(beat.component.props ?? {})}
          onAdvance={onAdvance}
        />
      </div>
    </Surface>
  );
}
