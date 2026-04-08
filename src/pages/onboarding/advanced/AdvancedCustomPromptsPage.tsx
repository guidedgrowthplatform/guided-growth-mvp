import { Icon } from '@iconify/react';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { speak, stopTTS } from '@/lib/services/tts-service';

type JournalMode = 'freeform' | 'custom';

interface LocationState {
  habitConfigs?: Array<{ name: string; days: number[] }>;
  customPrompts?: string[];
  journalMode?: JournalMode;
}

export function AdvancedCustomPromptsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [journalMode, setJournalMode] = useState<JournalMode>(state?.journalMode ?? 'custom');
  const [prompts, setPrompts] = useState<string[]>(
    state?.customPrompts?.length ? state.customPrompts : [],
  );
  const [newPrompt, setNewPrompt] = useState('');

  const filledPrompts = prompts.filter((p) => p.trim().length > 0);
  const canSubmit = journalMode === 'freeform' || filledPrompts.length >= 1;

  // TTS per Voice Journey Spreadsheet v3 (line 306)
  useEffect(() => {
    speak("What questions do you want to reflect on each day? Just say them and I'll add them.");
    return () => {
      stopTTS();
    };
  }, []);

  function updatePrompt(index: number, value: string) {
    setPrompts((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  function deletePrompt(index: number) {
    setPrompts((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDone() {
    navigate('/onboarding/advanced-step-6', {
      state: {
        habitConfigs: state?.habitConfigs,
        customPrompts: journalMode === 'custom' ? filledPrompts : undefined,
        journalMode,
      },
    });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface-secondary px-6 py-6">
      {/* Back Arrow */}
      <div className="pb-[32px]">
        <button
          type="button"
          onClick={() =>
            navigate('/onboarding/advanced-step-6', {
              state: { habitConfigs: state?.habitConfigs },
            })
          }
          className="flex size-[40px] items-center justify-center"
        >
          <Icon icon="ic:round-arrow-back" width={16} height={16} className="text-content" />
        </button>
      </div>

      {/* Heading + Subtitle */}
      <div className="flex flex-col gap-[12px] pb-[32px]">
        <h1 className="text-[30px] font-bold leading-[36px] text-content">
          How do you want to journal?
        </h1>
        <p className="text-[16px] leading-[26px] text-content-secondary">
          Choose a blank canvas or design your own specific questions.
        </p>
      </div>

      {/* Radio Cards */}
      <div className="flex flex-col gap-[16px]">
        {/* Freeform Option */}
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

        {/* Custom Prompts Option */}
        <div
          onClick={() => setJournalMode('custom')}
          className={`cursor-pointer rounded-[20px] p-[22px] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] ${
            journalMode === 'custom'
              ? 'border-2 border-primary bg-primary/5'
              : 'border border-border bg-surface'
          }`}
        >
          {/* Header */}
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

          {/* Expanded content when custom is selected */}
          {journalMode === 'custom' && (
            <div className="mt-[16px] flex flex-col gap-[16px]">
              <div className="border-t border-border" />
              <span className="text-[14px] font-semibold uppercase leading-[20px] tracking-[0.7px] text-content-secondary">
                Add at least 1 prompt:
              </span>

              {/* Filled prompts */}
              {prompts.map((prompt, i) =>
                prompt.trim() ? (
                  <div key={i} className="flex items-center">
                    <input
                      type="text"
                      value={prompt}
                      onChange={(e) => updatePrompt(i, e.target.value)}
                      className="flex-1 rounded-[12px] border border-border bg-white px-[17px] py-[13px] text-[16px] leading-[24px] text-content shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
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

              {/* Empty input + helper text */}
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
                  className="w-full rounded-[12px] border border-border bg-white px-[17px] py-[11px] text-[14px] text-content shadow-[0px_1px_2px_rgba(0,0,0,0.05)] placeholder:text-content-secondary"
                />
                <p className="px-[4px] text-[12px] leading-[16px] text-content-secondary">
                  Or just tap the mic and say your prompts out loud. We'll list them for you.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <CustomPromptsMic />

      {/* CTA Footer */}
      <div className="mt-auto pb-[8px] pt-[16px]">
        <button
          type="button"
          onClick={handleDone}
          disabled={!canSubmit}
          className="w-full rounded-full bg-primary py-[16px] text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] disabled:opacity-50"
        >
          I'm Done
        </button>
      </div>
    </div>
  );
}

function CustomPromptsMic() {
  const { isListening, toggle } = useVoiceInput();
  return (
    <div className="flex flex-col items-center justify-center py-[20px]">
      <div className="rounded-full shadow-[0px_0px_0px_8px_rgba(19,91,236,0.05),0px_0px_0px_16px_rgba(19,91,236,0.02)]">
        <button
          type="button"
          onClick={toggle}
          className={`flex size-[72px] items-center justify-center rounded-full shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.3),0px_4px_6px_-4px_rgba(19,91,236,0.3)] transition-all ${
            isListening ? 'scale-110 bg-danger' : 'bg-primary'
          }`}
        >
          <Icon
            icon={isListening ? 'ic:round-stop' : 'ic:round-mic'}
            width={20}
            height={20}
            className="text-white"
          />
        </button>
      </div>
      {isListening && (
        <p className="mt-3 animate-pulse text-sm font-medium text-primary">Listening...</p>
      )}
    </div>
  );
}
