import { useState, useCallback, useRef } from 'react';

interface AffirmationFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function AffirmationField({ value, onChange }: AffirmationFieldProps) {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = useCallback((newValue: string) => {
    setLocalValue(newValue);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(newValue), 500);
  }, [onChange]);

  return (
    <div className="bg-surface shadow-card border border-border rounded-2xl p-4">
      <label className="block text-sm font-semibold text-primary mb-2">Daily Affirmation</label>
      <textarea
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-surface outline-none focus:ring-2 focus:ring-primary resize-none transition-all"
        rows={2}
        placeholder="Write your affirmation for the day..."
      />
    </div>
  );
}
