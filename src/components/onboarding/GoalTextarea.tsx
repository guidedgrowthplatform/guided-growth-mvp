import type { RefObject } from 'react';

interface GoalTextareaProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textareaRef?: RefObject<HTMLTextAreaElement>;
}

const DEFAULT_PLACEHOLDER =
  'Or type your thoughts here...\n\nExamples: I want to sleep earlier, stop eating junk food at night, work out three times a week, and not be on my phone at 9.30 PM';

export function GoalTextarea({
  value,
  onChange,
  placeholder = DEFAULT_PLACEHOLDER,
  textareaRef,
}: GoalTextareaProps) {
  return (
    <div className="min-h-[140px] w-full rounded-[16px] bg-surface-secondary pb-[40px] pl-[20px] pr-0 pt-[20px] shadow-[0px_4px_20px_0px_rgba(0,0,0,0.05)]">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-none bg-transparent text-[15px] font-medium leading-[22px] text-content outline-none placeholder:text-content-tertiary [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-[4px]"
        rows={5}
      />
    </div>
  );
}
