import { Icon } from '@iconify/react';
import { useState } from 'react';

interface OnboardingInputProps {
  icon: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'email' | 'password';
  autoComplete?: string;
  disabled?: boolean;
  onEnter?: () => void;
}

export function OnboardingInput({
  icon,
  placeholder,
  value,
  onChange,
  type = 'text',
  autoComplete,
  disabled,
  onEnter,
}: OnboardingInputProps) {
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (reveal ? 'text' : 'password') : type;
  return (
    <div className="relative rounded-[16px] bg-surface-secondary shadow-[0px_4px_20px_-2px_rgba(0,0,0,0.05)]">
      <span className="absolute left-[16px] top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center">
        <Icon icon={icon} width={16} height={16} className="text-content-tertiary" />
      </span>
      <input
        type={inputType}
        inputMode={type === 'email' ? 'email' : undefined}
        autoComplete={autoComplete}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={
          onEnter
            ? (e) => {
                if (e.key === 'Enter') onEnter();
              }
            : undefined
        }
        className={`w-full bg-transparent py-[14px] pl-[48px] text-[18px] text-content outline-none placeholder:font-normal placeholder:text-content-tertiary disabled:opacity-60 ${isPassword ? 'pr-[48px]' : 'pr-[16px]'}`}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          aria-label={reveal ? 'Hide password' : 'Show password'}
          className="absolute right-[16px] top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-content-tertiary"
        >
          <Icon icon={reveal ? 'mdi:eye-off-outline' : 'mdi:eye-outline'} width={18} height={18} />
        </button>
      )}
    </div>
  );
}
