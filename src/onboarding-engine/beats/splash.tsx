import { Splash } from '@/components/flow-designer/beats/splash';
import { Orb } from '@/components/orb/Orb';
import { orbIdle } from '@/components/orb/orbView';
import type { OnboardingBeat } from '@/generated/onboardingContract';
import { Surface } from './_shared';

export default function SplashPreview({ beat }: { beat: OnboardingBeat; onAdvance: () => void }) {
  return (
    <Surface beat={beat}>
      <div
        data-testid="splash-preview-real"
        style={{ minHeight: 312, display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Splash />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
          <Orb {...orbIdle(56, true, true, { frozen: true })} />
        </div>
      </div>
    </Surface>
  );
}
