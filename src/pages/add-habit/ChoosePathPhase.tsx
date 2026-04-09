import { SelectionCard } from '@/components/onboarding/SelectionCard';
import { AddHabitHeader } from './AddHabitHeader';

interface ChoosePathPhaseProps {
  path: 'simple' | 'braindump' | null;
  setPath: (p: 'simple' | 'braindump') => void;
  onContinue: () => void;
  onBack: () => void;
}

export function ChoosePathPhase({ path, setPath, onContinue, onBack }: ChoosePathPhaseProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg px-5 pb-[120px] pt-[max(16px,env(safe-area-inset-top))]">
      <AddHabitHeader onBack={onBack} />
      <div className="mb-8 flex flex-col gap-[11px]">
        <h2 className="text-[28px] font-bold leading-[36px] tracking-[-0.5px] text-content">
          How would you like to add habits?
        </h2>
        <p className="text-[16px] font-medium leading-[26px] text-content-secondary">
          Choose your preferred way to get started.
        </p>
      </div>
      <div className="flex flex-col gap-5">
        <SelectionCard
          icon="ic:outline-explore"
          iconBg="#E2E8F0"
          iconColor="rgb(var(--color-primary))"
          title="Pick from a list"
          description="Browse and select from recommended habits"
          selected={path === 'simple'}
          onSelect={() => setPath('simple')}
        />
        <SelectionCard
          icon="ic:round-mic"
          iconBg="#E2E8F0"
          iconColor="#8B5CF6"
          title="Tell me what you want"
          description="Describe your goals and I'll organize habits for you"
          selected={path === 'braindump'}
          onSelect={() => setPath('braindump')}
          showSparkle
        />
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 bg-primary-bg px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          disabled={!path}
          onClick={onContinue}
          className="h-[56px] w-full rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25)] disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
