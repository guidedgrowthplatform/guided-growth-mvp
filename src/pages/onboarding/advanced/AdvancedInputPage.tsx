import { Icon } from '@iconify/react';
import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoalTextarea } from '@/components/onboarding/GoalTextarea';
import { GuidanceBadge } from '@/components/onboarding/GuidanceBadge';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { VoiceMicButton } from '@/components/onboarding/VoiceMicButton';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceStore } from '@/stores/voiceStore';

export function AdvancedInputPage() {
  const navigate = useNavigate();
  const { saveStepAsync } = useOnboarding();
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null!);
  const { isListening, toggle, transcript } = useVoiceInput();
  const resetTranscript = useVoiceStore((s) => s.resetTranscript);

  // Append voice transcript to text
  useEffect(() => {
    if (!isListening && transcript) {
      setText((prev) => (prev ? prev + '\n' + transcript : transcript));
      resetTranscript();
    }
  }, [isListening, transcript, resetTranscript]);

  // Speak prompt on mount
  useEffect(() => {
    import('@/lib/services/tts-service').then(({ speak }) => {
      speak("Tell me what habits you want to build. You can just list them out, like 'I want to read 20 pages and run every morning'.");
    });
  }, []);

  function handleKeyboardPress() {
    textareaRef.current?.scrollIntoView({ behavior: 'smooth' });
    textareaRef.current?.focus();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface-secondary px-[24px] pb-[32px] pt-[max(16px,env(safe-area-inset-top))]">
      <button
        type="button"
        onClick={() => navigate('/onboarding/step-2')}
        className="mb-[12px] flex size-[40px] items-center justify-center rounded-full"
      >
        <Icon icon="ic:round-arrow-back" width={16} height={16} className="text-content" />
      </button>

      <OnboardingProgress currentStep={3} totalSteps={6} />

      <div className="flex flex-col gap-[11px]">
        <h1 className="text-[32px] font-bold leading-[40px] tracking-[-0.8px] text-content">
          Tell me what you want to achieve
        </h1>
        <p className="text-[18px] font-medium leading-[29.25px] text-content-secondary">
          You can say or type as much as you want. We'll organize it for you.
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-[24px] py-[32px]">
        <VoiceMicButton isListening={isListening} onPress={toggle} />
        {isListening && (
          <p className="animate-pulse text-sm font-medium text-primary">Listening...</p>
        )}
        <GuidanceBadge text='TRY: "I WOULD LIKE TO READ FOR 15 MINS EVERY NIGHT AT 8 PM"' />
        <GoalTextarea value={text} onChange={setText} textareaRef={textareaRef} />
      </div>

      <div className="flex items-center gap-[16px]">
        <button
          type="button"
          onClick={handleKeyboardPress}
          className="rounded-full bg-white p-[16px] shadow-[0px_4px_20px_0px_rgba(0,0,0,0.05)]"
        >
          <Icon icon="ic:round-keyboard" className="size-[24px] text-content-tertiary" />
        </button>
        <button
          type="button"
          disabled={text.trim() === ''}
          onClick={async () => {
            await saveStepAsync(3, {}, { brainDump: { raw: text } });
            navigate('/onboarding/advanced-results', { state: { text } });
          }}
          className="flex-1 rounded-full bg-primary py-[16px] text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25),0px_4px_6px_-4px_rgba(19,91,236,0.25)] disabled:opacity-50"
        >
          Done
        </button>
      </div>
    </div>
  );
}
