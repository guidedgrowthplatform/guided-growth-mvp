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
    <div className="glass rounded-2xl p-4 border border-cyan-200/50">
      <label className="block text-sm font-semibold text-cyan-700 mb-2">Daily Affirmation</label>
      <textarea
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-cyan-200/50 rounded-xl bg-white/80 outline-none focus:ring-2 focus:ring-cyan-400 resize-none transition-all"
        rows={2}
        placeholder="Write your affirmation for the day..."
      />
    </div>
  );
}
