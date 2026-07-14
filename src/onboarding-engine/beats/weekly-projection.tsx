import type { MouseEvent } from 'react';
import weeklyProjectionBeat, {
  type ProjectionState,
} from '@/components/flow-designer/beats/weeklyProjection';
import { Orb } from '@/components/orb/Orb';
import { orbIdle } from '@/components/orb/orbView';
import type { OnboardingBeat } from '@/generated/onboardingContract';
import { Surface } from './_shared';

type WeeklyProjectionProps = {
  state: ProjectionState;
  coachLine?: string;
  locale?: string;
};

const WeeklyProjection = weeklyProjectionBeat.Comp as unknown as (
  props: WeeklyProjectionProps,
) => JSX.Element;

export default function WeeklyProjectionPreview({
  beat,
  onAdvance,
}: {
  beat: OnboardingBeat;
  onAdvance: () => void;
}) {
  const componentProps = (beat.component.props ?? {}) as WeeklyProjectionProps;
  const componentConfig = beat.component.config ?? {};

  function handleNext(event: MouseEvent<HTMLDivElement>) {
    const button = (event.target as HTMLElement).closest('button');
    if (button?.textContent?.trim() !== 'Next') return;

    event.stopPropagation();
    onAdvance();
  }

  return (
    <Surface beat={beat}>
      <div
        data-testid="weekly-projection-preview-real"
        style={{ minHeight: 312, marginTop: 12 }}
        onClickCapture={handleNext}
      >
        {componentConfig.hideOrb !== true && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <Orb {...orbIdle(48, true, true, { frozen: true })} />
          </div>
        )}
        <WeeklyProjection key={beat.id} {...componentProps} />
      </div>
    </Surface>
  );
}
