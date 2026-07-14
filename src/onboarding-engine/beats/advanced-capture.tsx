import advancedCaptureBeat from '@/components/flow-designer/beats/advancedCapture';
import { Orb } from '@/components/orb/Orb';
import { orbIdle } from '@/components/orb/orbView';
import type { OnboardingBeat } from '@/generated/onboardingContract';
import { Surface } from './_shared';

const AdvancedCapture = advancedCaptureBeat.Comp as (props: Record<string, unknown>) => JSX.Element;

export default function AdvancedCapturePreview({
  beat,
  onAdvance,
}: {
  beat: OnboardingBeat;
  onAdvance: () => void;
}) {
  const componentConfig = beat.component.config ?? {};

  return (
    <Surface beat={beat}>
      <div
        data-testid="advanced-capture-preview-real"
        style={{ minHeight: 312, marginTop: 12 }}
      >
        {componentConfig.hideOrb !== true && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <Orb {...orbIdle(48, true, true, { frozen: true })} />
          </div>
        )}
        <AdvancedCapture
          {...beat.component.config}
          {...(beat.component.props ?? {})}
          onAdvance={onAdvance}
        />
      </div>
    </Surface>
  );
}
