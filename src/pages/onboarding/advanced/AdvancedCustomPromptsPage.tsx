import { Icon } from '@iconify/react';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingAgent } from '@/hooks/useOnboardingAgent';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';

type JournalMode = 'freeform' | 'custom';

interface LocationState {
  habitConfigs?: Array<{ name: string; days: number[] }>;
  customPrompts?: string[];
  journalMode?: JournalMode;
}

function deserializePrompts(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    return value
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function AdvancedCustomPromptsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: onboardingState } = useOnboarding();
  const state = location.state as LocationState | null;

  useOnboardingAgent('onboard_advanced_custom_prompts');
  useAgentNavigation(5, '/onboarding/advanced-step-6');

  const [journalMode, setJournalMode] = useState<JournalMode>(state?.journalMode ?? 'custom');
  const [prompts, setPrompts] = useState<string[]>(
    state?.customPrompts?.length ? state.customPrompts : [],
  );
  const [newPrompt, setNewPrompt] = useState('');

  useEffect(() => {
    const incoming = onboardingState?.data?.customPrompts;
    const list = deserializePrompts(incoming);
    if (list.length > 0) {
      setPrompts((prev) => (prev.length === 0 ? list : prev));
      if (list.length > 0) setJournalMode('custom');
    }
  }, [onboardingState?.data?.customPrompts]);

  const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
    if (!result.params) return;
    const list = deserializePrompts(result.params.customPrompts ?? result.params.prompts);
    if (list.length > 0) {
      setPrompts(list);
      setJournalMode('custom');
    }
  }, []);

  const filledPrompts = prompts.filter((p) => p.trim().length > 0);
  const canSubmit = journalMode === 'freeform' || filledPrompts.length >= 1;

  function updatePrompt(index: number, value: string) {
    setPrompts((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  function deletePrompt(index: number) {
    setPrompts((prev) => prev.filter((_, i) => i !== index));
  }

  const handleDone = useCallback(() => {
    navigate('/onboarding/advanced-step-6', {
      state: {
        habitConfigs: state?.habitConfigs,
        customPrompts: journalMode === 'custom' ? filledPrompts : undefined,
        journalMode,
      },
    });
  }, [navigate, state?.habitConfigs, journalMode, filledPrompts]);

  return (
    <OnboardingLayout
      currentStep={5}
      totalSteps={6}
      ctaLabel="Continue"
      onBack={() =>
        navigate('/onboarding/advanced-step-6', { state: { habitConfigs: state?.habitConfigs } })
      }
      onNext={handleDone}
      ctaDisabled={!canSubmit}
      showVoiceButton
      voiceFileId="ONBOARD-ADV-PROMPTS"
      voicePrompt="What questions do you want to reflect on each day? Just say them and I'll add them."
      voiceOptions={[]}
      onVoiceAction={handleVoiceAction}
    >
      <OnboardingHeader
        title="How do you want to journal?"
        subtitle="Choose a blank canvas or design your own specific questions."
      />

      <div className="flex flex-col gap-[16px]">
        <button
          type="button"
          onClick={() => setJournalMode('freeform')}
          className={`rounded-[20px] p-[21px] text-left shadow-[0px_1px_2px_rgba(0,0,0,0.05)] ${
            journalMode === 'freeform'
              ? 'border-2 border-primary bg-primary/5'
              : 'border border-border bg-surface'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-1">
              <Icon
                icon="mdi:pencil"
                width={18}
                height={20}
                className="mt-[2px] shrink-0 text-content"
              />
              <div className="flex flex-col pl-[12px]">
                <span className="text-[18px] font-bold text-content">Freeform Journaling</span>
                <span className="mt-[4px] text-[14px] leading-[22.75px] text-content-secondary">
                  No rules, no set questions. Just a blank space to talk or vent about whatever is
                  on your mind each day.
                </span>
              </div>
            </div>
            <div
              className={`ml-[12px] mt-[2px] flex size-[20px] shrink-0 items-center justify-center rounded-full border-2 ${
                journalMode === 'freeform' ? 'border-primary bg-primary' : 'border-border'
              }`}
            >
              {journalMode === 'freeform' && <div className="size-[8px] rounded-full bg-white" />}
            </div>
          </div>
        </button>

        <div
          onClick={() => setJournalMode('custom')}
          className={`cursor-pointer rounded-[20px] p-[22px] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] ${
            journalMode === 'custom'
              ? 'border-2 border-primary bg-primary/5'
              : 'border border-border bg-surface'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Icon
                icon="material-symbols:format-list-bulleted"
                width={18}
                height={15}
                className="text-content"
              />
              <span className="pl-[12px] text-[18px] font-bold text-content">Custom Prompts</span>
            </div>
            <div
              className={`flex size-[20px] items-center justify-center rounded-full border-2 ${
                journalMode === 'custom' ? 'border-primary bg-primary' : 'border-border'
              }`}
            >
              {journalMode === 'custom' && <div className="size-[8px] rounded-full bg-white" />}
            </div>
          </div>

          {journalMode === 'custom' && (
            <div className="mt-[16px] flex flex-col gap-[16px]">
              <div className="border-t border-border" />
              <span className="text-[14px] font-semibold uppercase leading-[20px] tracking-[0.7px] text-content-secondary">
                Add at least 1 prompt:
              </span>

              {prompts.map((prompt, i) =>
                prompt.trim() ? (
                  <div key={i} className="flex items-center">
                    <input
                      type="text"
                      value={prompt}
                      onChange={(e) => updatePrompt(i, e.target.value)}
                      className="flex-1 rounded-[12px] border border-border bg-surface-secondary px-[17px] py-[13px] text-[16px] leading-[24px] text-content shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePrompt(i);
                      }}
                      className="shrink-0 p-[8px] pl-[8px]"
                    >
                      <Icon
                        icon="ic:round-close"
                        width={12}
                        height={12}
                        className="text-content-secondary"
                      />
                    </button>
                  </div>
                ) : null,
              )}

              <div className="flex flex-col gap-[8px]">
                <input
                  type="text"
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newPrompt.trim()) {
                      setPrompts([...prompts, newPrompt.trim()]);
                      setNewPrompt('');
                    }
                  }}
                  onBlur={() => {
                    if (newPrompt.trim()) {
                      setPrompts([...prompts, newPrompt.trim()]);
                      setNewPrompt('');
                    }
                  }}
                  placeholder="Type your next prompt here..."
                  className="w-full rounded-[12px] border border-border bg-surface-secondary px-[17px] py-[11px] text-[14px] text-content shadow-[0px_1px_2px_rgba(0,0,0,0.05)] placeholder:text-content-secondary"
                />
                <p className="px-[4px] text-[12px] leading-[16px] text-content-secondary">
                  Or tap the mic above and say your prompts out loud. We'll list them for you.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </OnboardingLayout>
  );
}
