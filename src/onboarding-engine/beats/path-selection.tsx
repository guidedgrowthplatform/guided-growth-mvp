import { PathSelectionBeat } from '@/components/flow-designer/beats/pathSelection';
import type { OnboardingBeat } from '@/generated/onboardingContract';
import { Surface } from './_shared';

export default function PathSelectionPreview({
  beat,
  onAdvance,
}: {
  beat: OnboardingBeat;
  onAdvance: () => void;
}) {
  return (
    <Surface beat={beat}>
      <div
        data-testid="path-selection-preview-real"
        style={{ minHeight: 312, display: 'grid', alignItems: 'center' }}
      >
        <PathSelectionBeat
          {...beat.component.config}
          {...(beat.component.props ?? {})}
          onAdvance={onAdvance}
        />
      </div>
    </Surface>
  );
}
