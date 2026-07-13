import { AuthSignup } from '@/components/flow-designer/beats/authSignup';
import type { OnboardingBeat } from '@/generated/onboardingContract';
import { Surface } from './_shared';

export default function AuthSignupPreview({
  beat,
  onAdvance,
}: {
  beat: OnboardingBeat;
  onAdvance: () => void;
}) {
  return (
    <Surface beat={beat}>
      <div
        data-testid="auth-signup-preview-real"
        style={{ minHeight: 312, display: 'grid', alignItems: 'center' }}
      >
        <AuthSignup
          {...beat.component.config}
          {...(beat.component.props ?? {})}
          onAdvance={onAdvance}
        />
      </div>
    </Surface>
  );
}
