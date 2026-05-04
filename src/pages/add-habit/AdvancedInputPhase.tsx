import { Icon } from '@iconify/react';
import type { RefObject } from 'react';
import { GuidanceBadge } from '@/components/onboarding/GuidanceBadge';
import { VoiceMicButton } from '@/components/onboarding/VoiceMicButton';
import { AddHabitHeader } from './AddHabitHeader';

const PLACEHOLDER =
  'Or type your thoughts here...\n\nExamples: I want to sleep earlier, stop eating junk food at night, work out three times a week, and not be on my phone at 9.30 PM';

interface AdvancedInputPhaseProps {
  brainDumpText: string;
  setBrainDumpText: (text: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  isListening: boolean;
  toggleVoice: () => void;
  onDone: () => void;
  onBack: () => void;
}

export function AdvancedInputPhase({
  brainDumpText,
  setBrainDumpText,
  textareaRef,
  isListening,
  toggleVoice,
  onDone,
  onBack,
}: AdvancedInputPhaseProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg px-5 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
      <AddHabitHeader onBack={onBack} />
      <div className="flex flex-col gap-[11px]">
        <h2 className="text-[28px] font-bold leading-[36px] tracking-[-0.5px] text-content">
          Tell me what you want to achieve
        </h2>
        <p className="text-[16px] font-medium leading-[26px] text-content-secondary">
          You can say or type as much as you want. We'll organize it for you.
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8">
        <VoiceMicButton isListening={isListening} onPress={toggleVoice} />
        {isListening && (
          <p className="animate-pulse text-sm font-medium text-primary">Listening...</p>
        )}
        <GuidanceBadge text='TRY: "I WOULD LIKE TO READ FOR 15 MINS EVERY NIGHT AT 8 PM"' />
        <div className="min-h-[140px] w-full rounded-2xl bg-surface/60 px-5 pb-10 pt-5">
          <textarea
            ref={textareaRef}
            value={brainDumpText}
            onChange={(e) => setBrainDumpText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={5}
            className="w-full resize-none bg-transparent text-[15px] font-medium leading-[22px] text-content outline-none placeholder:text-content-tertiary"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => {
            textareaRef.current?.scrollIntoView({ behavior: 'smooth' });
            textareaRef.current?.focus();
          }}
          className="rounded-full bg-surface-secondary p-4 shadow-[0px_4px_20px_0px_rgba(0,0,0,0.05)]"
        >
          <Icon icon="ic:round-keyboard" className="size-6 text-content-tertiary" />
        </button>
        <button
          type="button"
          disabled={brainDumpText.trim() === ''}
          onClick={onDone}
          className="flex-1 rounded-full bg-primary py-4 text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25)] disabled:opacity-50"
        >
          Done
        </button>
      </div>
    </div>
  );
}
