import type { ReactNode } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';

interface Option {
  value: string;
  label: string;
  description: string;
}

interface VoiceSettingsSheetProps {
  title: string;
  options: Option[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  extraContent?: ReactNode;
}

export function VoiceSettingsSheet({
  title,
  options,
  selected,
  onSelect,
  onClose,
  extraContent,
}: VoiceSettingsSheetProps) {
  return (
    <BottomSheet onClose={onClose}>
      <div className="px-6 pb-8 pt-2">
        <h2 className="mb-4 text-xl font-bold text-content">{title}</h2>
        <div className="space-y-3">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                selected === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-surface'
              }`}
            >
              <span className="font-bold text-content">{option.label}</span>
              <p className="mt-1 text-sm text-content-secondary">{option.description}</p>
            </button>
          ))}
        </div>
        {extraContent && <div className="mt-4">{extraContent}</div>}
      </div>
    </BottomSheet>
  );
}
