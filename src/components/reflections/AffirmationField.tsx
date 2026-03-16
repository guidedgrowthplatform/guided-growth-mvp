import { useState, useCallback, useRef } from 'react';

interface AffirmationFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function AffirmationField({ value, onChange }: AffirmationFieldProps) {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChange(newValue), 500);
    },
    [onChange],
  );

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <label className="mb-2 block text-sm font-semibold text-primary">Daily Affirmation</label>
      <textarea
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-primary"
        rows={2}
        placeholder="Write your affirmation for the day..."
      />
    </div>
  );
}
