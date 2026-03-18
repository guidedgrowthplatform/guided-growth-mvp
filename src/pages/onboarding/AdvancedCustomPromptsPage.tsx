import { Icon } from '@iconify/react';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

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

  const filledPrompts = prompts.filter((p) => p.trim().length > 0);
  const canSubmit = journalMode === 'freeform' || filledPrompts.length >= 1;

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
    <div className="flex min-h-dvh flex-col bg-[#f9f9f9] p-[24px]">
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
          <Icon icon="ic:round-arrow-back" width={16} height={16} className="text-[#0f172a]" />
        </button>
      </div>

      {/* Heading + Subtitle */}
      <div className="flex flex-col gap-[12px] pb-[32px]">
        <h1 className="text-[30px] font-bold leading-[36px] text-[#0f172a]">
          How do you want to journal?
        </h1>
        <p className="text-[16px] leading-[26px] text-[#718096]">
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
              ? 'border-2 border-[#135bec] bg-[#eff6ff]'
              : 'border border-[#e2e8f0] bg-white'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-1">
              <Icon
                icon="mdi:pencil"
                width={18}
                height={20}
                className="mt-[2px] shrink-0 text-[#1a202c]"
              />
              <div className="flex flex-col pl-[12px]">
                <span className="text-[18px] font-bold text-[#1a202c]">Freeform Journaling</span>
                <span className="mt-[4px] text-[14px] leading-[22.75px] text-[#718096]">
                  No rules, no set questions. Just a blank space to talk or vent about whatever is
                  on your mind each day.
                </span>
              </div>
            </div>
            <div
              className={`ml-[12px] mt-[2px] flex size-[20px] shrink-0 items-center justify-center rounded-full border-2 ${
                journalMode === 'freeform' ? 'border-[#135bec] bg-[#135bec]' : 'border-[#e2e8f0]'
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
              ? 'border-2 border-[#135bec] bg-[#eff6ff]'
              : 'border border-[#e2e8f0] bg-white'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Icon
                icon="material-symbols:format-list-bulleted"
                width={18}
                height={15}
                className="text-[#1a202c]"
              />
              <span className="pl-[12px] text-[18px] font-bold text-[#1a202c]">Custom Prompts</span>
            </div>
            <div
              className={`flex size-[20px] items-center justify-center rounded-full border-2 ${
                journalMode === 'custom' ? 'border-[#135bec] bg-[#135bec]' : 'border-[#e2e8f0]'
              }`}
            >
              {journalMode === 'custom' && <div className="size-[8px] rounded-full bg-white" />}
            </div>
          </div>

          {/* Expanded content when custom is selected */}
          {journalMode === 'custom' && (
            <div className="flex flex-col gap-[16px]">
              <div className="border-t border-[#e2e8f0]" />
              <span className="text-[14px] font-semibold uppercase leading-[20px] tracking-[0.7px] text-[#718096]">
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
                      className="flex-1 rounded-[12px] border border-[#e2e8f0] bg-white px-[17px] py-[13px] text-[16px] leading-[24px] text-[#1a202c] shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
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
                        className="text-[#718096]"
                      />
                    </button>
                  </div>
                ) : null,
              )}

              {/* Empty input + helper text */}
              <div className="flex flex-col gap-[8px]">
                <input
                  type="text"
                  value=""
                  onChange={(e) => {
                    if (e.target.value.trim()) {
                      setPrompts([...prompts, e.target.value]);
                    }
                  }}
                  placeholder="Type your next prompt here..."
                  className="w-full rounded-[12px] border border-[#e2e8f0] bg-white px-[17px] py-[15px] text-[16px] text-[#1a202c] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] placeholder:text-[#718096]"
                />
                <p className="px-[4px] text-[12px] leading-[16px] text-[#718096]">
                  Or just tap the mic and say your prompts out loud. We'll list them for you.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Voice Button */}
      <div className="flex justify-center py-[32px]">
        <div className="rounded-full shadow-[0px_0px_0px_12px_rgba(19,91,236,0.05),0px_0px_0px_24px_rgba(19,91,236,0.02)]">
          <button
            type="button"
            className="flex size-[96px] items-center justify-center rounded-full bg-[#135bec] shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.3),0px_4px_6px_-4px_rgba(19,91,236,0.3)]"
          >
            <Icon icon="ic:round-mic" width={24} height={24} className="text-white" />
          </button>
        </div>
      </div>

      {/* CTA Footer */}
      <div className="mt-auto pb-[8px] pt-[24px]">
        <button
          type="button"
          onClick={handleDone}
          disabled={!canSubmit}
          className="w-full rounded-full bg-[#135bec] py-[16px] text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] disabled:opacity-50"
        >
          I'm Done
        </button>
      </div>
    </div>
  );
}
