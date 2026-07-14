import advancedFrequencyBeat from '@/components/flow-designer/beats/advancedFrequency';
import { Orb } from '@/components/orb/Orb';
import { orbIdle } from '@/components/orb/orbView';
import type { OnboardingBeat } from '@/generated/onboardingContract';
import { Surface } from './_shared';

const AdvancedFrequency = advancedFrequencyBeat.Comp as (props: Record<string, unknown>) => JSX.Element;

export default function AdvancedFrequencyPreview({
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
        data-testid="advanced-frequency-preview-real"
        style={{ minHeight: 312, marginTop: 12 }}
      >
        {componentConfig.hideOrb !== true && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <Orb {...orbIdle(48, true, true, { frozen: true })} />
          </div>
        )}
        <AdvancedFrequency
          {...beat.component.config}
          {...(beat.component.props ?? {})}
          onAdvance={onAdvance}
        />
      </div>
    </Surface>
  );
}
