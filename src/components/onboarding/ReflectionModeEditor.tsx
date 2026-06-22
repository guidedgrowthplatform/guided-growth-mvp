import { Icon } from '@iconify/react';
import { useState } from 'react';
import type { ReflectionMode } from '@gg/shared/types';

interface ReflectionModeEditorProps {
  mode: ReflectionMode;
  onModeChange: (mode: ReflectionMode) => void;
  prompts: string[];
  onPromptsChange: (prompts: string[]) => void;
}

// Shared mode-choice + custom-prompt editor for both onboarding paths.
// 'prompts' mode = answer questions (a user-editable list); 'freeform' = no questions.
export function ReflectionModeEditor({
  mode,
  onModeChange,
  prompts,
  onPromptsChange,
}: ReflectionModeEditorProps) {
  const [newPrompt, setNewPrompt] = useState('');

  function updatePrompt(index: number, value: string) {
    onPromptsChange(prompts.map((p, i) => (i === index ? value : p)));
  }

  function deletePrompt(index: number) {
    onPromptsChange(prompts.filter((_, i) => i !== index));
  }

  function commitNewPrompt() {
    if (newPrompt.trim()) {
      onPromptsChange([...prompts, newPrompt.trim()]);
      setNewPrompt('');
    }
  }

  return (
    <div className="flex flex-col gap-[16px]">
      <button
        type="button"
        onClick={() => onModeChange('freeform')}
        className={`rounded-[20px] bg-surface p-[21px] text-left shadow-[0px_1px_2px_rgba(0,0,0,0.05)] ${
          mode === 'freeform' ? 'border-2 border-primary' : 'border border-border'
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
              <span className="text-[18px] font-bold text-content">Freeform</span>
              <span className="mt-[4px] text-[14px] leading-[22.75px] text-content-secondary">
                No set questions. Just talk about whatever is on your mind.
              </span>
            </div>
          </div>
          <div
            className={`ml-[12px] mt-[2px] flex size-[20px] shrink-0 items-center justify-center rounded-full border-2 ${
              mode === 'freeform' ? 'border-primary bg-primary' : 'border-border'
            }`}
          >
            {mode === 'freeform' && <div className="size-[8px] rounded-full bg-white" />}
          </div>
        </div>
      </button>

      <div
        onClick={() => onModeChange('prompts')}
        className={`cursor-pointer rounded-[20px] bg-surface p-[22px] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] ${
          mode === 'prompts' ? 'border-2 border-primary' : 'border border-border'
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
              mode === 'prompts' ? 'border-primary bg-primary' : 'border-border'
            }`}
          >
            {mode === 'prompts' && <div className="size-[8px] rounded-full bg-white" />}
          </div>
        </div>

        {mode === 'prompts' && (
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
                    className="flex-1 rounded-[12px] border border-border bg-surface px-[17px] py-[13px] text-[16px] leading-[24px] text-content shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
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
                  if (e.key === 'Enter') commitNewPrompt();
                }}
                onBlur={commitNewPrompt}
                placeholder="Type your next prompt here..."
                className="w-full rounded-[12px] border border-border bg-surface px-[17px] py-[11px] text-[14px] text-content shadow-[0px_1px_2px_rgba(0,0,0,0.05)] placeholder:text-content-secondary"
              />
              <p className="px-[4px] text-[12px] leading-[16px] text-content-secondary">
                Or tap the mic above and say your prompts out loud. We'll list them for you.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
