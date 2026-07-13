import { useState } from 'react';
import { MorningCard } from '@/components/flow-designer/beats/morningCheckinSetup';
import { ritualWeekdaysForLocale } from '@/components/flow-designer/beats/ritualCadence';
import { toggleSetItem } from '@/components/onboarding/constants';
import { Orb } from '@/components/orb/Orb';
import { orbIdle } from '@/components/orb/orbView';
import type { OnboardingBeat } from '@/generated/onboardingContract';
import { Surface } from './_shared';

export default function MorningCheckinSetupPreview({
  beat,
  onAdvance,
}: {
  beat: OnboardingBeat;
  onAdvance: () => void;
}) {
  const componentProps = (beat.component.props ?? {}) as { defaultTime?: string; locale?: string };
  const componentConfig = beat.component.config ?? {};
  const [days, setDays] = useState<Set<number>>(() =>
    ritualWeekdaysForLocale(componentProps.locale),
  );
  const [time, setTime] = useState(componentProps.defaultTime ?? '08:00');
  const [remind, setRemind] = useState(true);

  return (
    <Surface beat={beat}>
      <div
        data-testid="morning-checkin-setup-preview-real"
        style={{ minHeight: 312, marginTop: 12 }}
      >
        {componentConfig.hideOrb !== true && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <Orb {...orbIdle(48, true, true, { frozen: true })} />
          </div>
        )}
        <MorningCard
          days={days}
          onToggleDay={(day) => setDays((current) => toggleSetItem(current, day))}
          time={time}
          onTimeChange={setTime}
          remind={remind}
          onToggleRemind={setRemind}
          revealCount={3}
        />
        <button
          type="button"
          onClick={onAdvance}
          className="mt-4 w-full rounded-[24px] bg-primary px-[16px] py-[14px] text-[16px] font-bold leading-[24px] text-white"
        >
          Continue
        </button>
      </div>
    </Surface>
  );
}
