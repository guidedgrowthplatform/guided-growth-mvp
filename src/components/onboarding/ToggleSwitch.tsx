interface ToggleSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
}

export function ToggleSwitch({ checked, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-[26px] w-[50px] rounded-full transition-colors ${
        checked ? 'bg-[#135bec]' : 'bg-[#e2e8f0]'
      }`}
    >
      <div
        className={`absolute top-[3px] size-[20px] rounded-full bg-white shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] transition-all ${
          checked ? 'left-[27px]' : 'left-[3px]'
        }`}
      />
    </button>
  );
}
