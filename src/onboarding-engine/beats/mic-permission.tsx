import { MicPermission } from '@/components/welcome/MicPermission';
import type { OnboardingBeat } from '@/generated/onboardingContract';
import { Surface } from './_shared';

export default function MicPermissionPreview({
  beat,
  onAdvance,
}: {
  beat: OnboardingBeat;
  onAdvance: () => void;
}) {
  const componentProps = (beat.component.props ?? {}) as { heading?: string; sub?: string };

  return (
    <Surface beat={beat}>
      <div
        data-testid="mic-permission-preview-real"
        style={{ height: 420, marginTop: 12, overflow: 'hidden' }}
      >
        <MicPermission
          {...beat.component.config}
          {...componentProps}
          subheading={componentProps.sub}
          onAllow={onAdvance}
          onSkip={onAdvance}
        />
      </div>
    </Surface>
  );
}
