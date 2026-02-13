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

  const handleChange = useCallback((newValue: string) => {
    setLocalValue(newValue);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(field.id, newValue), 500);
  }, [field.id, onChange]);

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
      <textarea
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-cyan-200/50 rounded-xl bg-white/80 outline-none focus:ring-2 focus:ring-cyan-400 resize-none transition-all"
        rows={3}
        placeholder={`Enter your ${field.label.toLowerCase()}...`}
      />
    </div>
  );
}
