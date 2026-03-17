import { Icon } from '@iconify/react';

interface OnboardingInputProps {
  icon: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}

export function OnboardingInput({ icon, placeholder, value, onChange }: OnboardingInputProps) {
  return (
    <div className="relative rounded-[16px] bg-white shadow-[0px_4px_20px_-2px_rgba(0,0,0,0.05)]">
      <span className="absolute left-[16px] top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center">
        <Icon icon={icon} width={16} height={16} className="text-[#94a3b8]" />
      </span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent py-[14px] pl-[48px] pr-[16px] text-[18px] text-[#0f172a] outline-none placeholder:font-normal placeholder:text-[#94a3b8]"
      />
    </div>
  );
}
