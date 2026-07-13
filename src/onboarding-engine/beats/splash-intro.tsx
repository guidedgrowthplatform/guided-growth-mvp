import { SplashIntro } from '@/components/welcome/SplashIntro';
import type { OnboardingBeat } from '@/generated/onboardingContract';
import { declaredClip, Surface } from './_shared';

export default function SplashIntroPreview({
  beat,
  onAdvance,
}: {
  beat: OnboardingBeat;
  onAdvance: () => void;
}) {
  return (
    <Surface beat={beat}>
      <div
        data-testid="splash-intro-preview-real"
        style={{ height: 420, marginTop: 12, overflow: 'hidden' }}
      >
        <SplashIntro
          {...beat.component.config}
          {...(beat.component.props ?? {})}
          audioSrc={declaredClip(beat) ?? undefined}
          onComplete={onAdvance}
        />
      </div>
    </Surface>
  );
}
