import { CustomEntryCard } from '@/components/flow-designer/beats/customEntry';
import type { OnboardingBeat } from '@/generated/onboardingContract';
import { Surface } from './_shared';

export default function CustomEntryPreview({
  beat,
  onAdvance,
}: {
  beat: OnboardingBeat;
  onAdvance: () => void;
}) {
  return (
    <Surface beat={beat}>
      <div
        data-testid="custom-entry-preview-real"
        style={{ minHeight: 312, display: 'grid', alignItems: 'center' }}
      >
        <CustomEntryCard
          {...beat.component.config}
          {...(beat.component.props ?? {})}
          onAdvance={onAdvance}
        />
      </div>
    </Surface>
  );
}
