import { Icon } from '@iconify/react';

interface OnboardingInputProps {
  icon: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  voiceField?: string;
}

export function OnboardingInput({
  icon,
  placeholder,
  value,
  onChange,
  voiceField,
}: OnboardingInputProps) {
  return (
    <div className="relative rounded-[16px] bg-surface-secondary shadow-[0px_4px_20px_-2px_rgba(0,0,0,0.05)]">
      <span className="absolute left-[16px] top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center">
        <Icon icon={icon} width={16} height={16} className="text-content-tertiary" />
      </span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-voice-field={voiceField}
        className="w-full bg-transparent py-[14px] pl-[48px] pr-[16px] text-[18px] text-content outline-none placeholder:font-normal placeholder:text-content-tertiary"
      />
    </div>
  );
}
