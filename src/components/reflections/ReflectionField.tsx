import { useState, useCallback, useRef } from 'react';
import type { ReflectionField as ReflectionFieldType } from '@shared/types';

interface ReflectionFieldProps {
  field: ReflectionFieldType;
  value: string;
  onChange: (fieldId: string, value: string) => void;
}

export function ReflectionField({ field, value, onChange }: ReflectionFieldProps) {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChange(field.id, newValue), 500);
    },
    [field.id, onChange],
  );

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-content">{field.label}</label>
      <textarea
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-primary"
        rows={3}
        placeholder={`Enter your ${field.label.toLowerCase()}...`}
      />
    </div>
  );
}
