import { Icon } from '@iconify/react';
import { type ReactNode, useState } from 'react';
import { AiListeningTooltip } from './AiListeningTooltip';
import { OnboardingProgress } from './OnboardingProgress';

interface OnboardingLayoutProps {
  currentStep: number;
  totalSteps: number;
  ctaLabel: string;
  onNext: () => void;
  ctaDisabled?: boolean;
  children: ReactNode;
  showVoiceButton?: boolean;
  onBack?: () => void;
  ctaVariant?: 'full' | 'inline';
  aiListeningPrompt?: string;
  footerText?: string;
  secondaryAction?: { label: string; onClick: () => void };
}

export function OnboardingLayout({
  currentStep,
  totalSteps,
  ctaLabel,
  onNext,
  ctaDisabled,
  children,
  showVoiceButton,
  onBack,
  ctaVariant = 'full',
  aiListeningPrompt,
  footerText,
  secondaryAction,
}: OnboardingLayoutProps) {
  const [isListening, setIsListening] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg px-[24px] pb-[48px] pt-[max(16px,env(safe-area-inset-top))]">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-2 flex size-[40px] items-center justify-center rounded-full"
        >
          <Icon icon="ic:round-arrow-back" width={16} height={16} className="text-content" />
        </button>
      )}
      <OnboardingProgress currentStep={currentStep} totalSteps={totalSteps} />
      <div
        className={`-mx-[2px] flex flex-1 flex-col gap-[16px] overflow-y-auto px-[2px] pt-4 ${ctaVariant === 'inline' ? 'pb-[80px]' : 'pb-4'}`}
      >
        {children}
      </div>
      {ctaVariant === 'full' ? (
        <>
          {showVoiceButton && (
            <div className="flex justify-center py-4">
              <button
                type="button"
                className="flex h-[56px] w-[56px] items-center justify-center rounded-full shadow-[0px_0px_15px_0px_rgba(19,91,236,0.3)]"
                style={{ background: 'linear-gradient(135deg, #135bec 0%, #2563eb 100%)' }}
              >
                <Icon icon="ic:round-mic" width={22} height={22} className="text-white" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={ctaDisabled}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-[20px] text-[18px] font-medium leading-[28px] text-white shadow-[0px_20px_25px_-5px_rgba(26,47,176,0.2),0px_8px_10px_-6px_rgba(26,47,176,0.2)] disabled:opacity-50"
          >
            {ctaLabel}
            <Icon icon="ic:round-arrow-forward" width={18} height={18} />
          </button>
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="w-full py-[12px] text-center text-[16px] font-semibold text-content"
            >
              {secondaryAction.label}
            </button>
          )}
        </>
      ) : (
        <div className="relative -mx-[24px] -mb-[48px] bg-gradient-to-t from-[#f9f9f9] via-[#f9f9f9] to-transparent px-[24px] pb-[40px] pt-[24px]">
          {aiListeningPrompt && (
            <div className="absolute bottom-full right-[24px] z-10 mb-[-8px]">
              <AiListeningTooltip text={aiListeningPrompt} visible={isListening} />
            </div>
          )}
          <div className="flex items-center gap-[8px]">
            <button
              type="button"
              onClick={onNext}
              disabled={ctaDisabled}
              className="flex h-[56px] flex-1 items-center justify-center rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25),0px_4px_6px_-4px_rgba(19,91,236,0.25)] disabled:opacity-50"
            >
              {ctaLabel}
            </button>
            {showVoiceButton && (
              <button
                type="button"
                onClick={() => setIsListening((v) => !v)}
                className="flex size-[56px] shrink-0 items-center justify-center rounded-full bg-primary shadow-[0px_25px_50px_-12px_rgba(19,91,236,0.4)]"
              >
                <Icon icon="ic:round-mic" width={22} height={22} className="text-white" />
              </button>
            )}
          </div>
          {footerText && (
            <p className="mt-[12px] text-center text-[12px] font-medium text-[#94a3b8]">
              {footerText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
