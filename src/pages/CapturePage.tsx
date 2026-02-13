import { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { CaptureView } from '@/components/capture/CaptureView';
import { ReflectionsPanel } from '@/components/reflections/ReflectionsPanel';
import { useReflections } from '@/hooks/useReflections';

export function CapturePage() {
  const [date] = useState(format(new Date(), 'yyyy-MM-dd'));
  const {
    config, reflections, affirmation, loading,
    initialize, saveDay: saveReflection, saveAffirmationValue,
  } = useReflections();

  useEffect(() => {
    const d = new Date(date);
    const start = format(startOfMonth(d), 'yyyy-MM-dd');
    const end = format(endOfMonth(d), 'yyyy-MM-dd');
    initialize(start, end);
  }, [date, initialize]);

  const handleFieldChange = useCallback((dateStr: string, fieldId: string, value: string) => {
    const dayReflections = { ...reflections[dateStr], [fieldId]: value };
    saveReflection(dateStr, dayReflections);
  }, [reflections, saveReflection]);

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Capture</h1>
      <CaptureView />
      <ReflectionsPanel
        date={date}
        config={config}
        reflections={reflections}
        affirmation={affirmation}
        onFieldChange={handleFieldChange}
        onAffirmationChange={saveAffirmationValue}
      />
    </div>
  );
}
