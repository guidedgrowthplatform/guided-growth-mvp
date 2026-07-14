import categoryGridBeat from '@/components/flow-designer/beats/categoryGrid';
import { Orb } from '@/components/orb/Orb';
import { orbIdle } from '@/components/orb/orbView';
import type { OnboardingBeat } from '@/generated/onboardingContract';
import { Surface } from './_shared';

const CategoryGrid = categoryGridBeat.Comp as (props: Record<string, unknown>) => JSX.Element;

export default function CategoryGridPreview({
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
        data-testid="category-grid-preview-real"
        style={{ minHeight: 312, marginTop: 12 }}
      >
        {componentConfig.hideOrb !== true && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <Orb {...orbIdle(48, true, true, { frozen: true })} />
          </div>
        )}
        <CategoryGrid
          {...beat.component.config}
          {...(beat.component.props ?? {})}
          onAdvance={onAdvance}
        />
      </div>
    </Surface>
  );
}
