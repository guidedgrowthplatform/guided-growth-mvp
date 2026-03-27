import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useState, useCallback, useMemo } from 'react';
import { CaptureView } from '@/components/capture/CaptureView';
import { ReflectionsPanel } from '@/components/reflections/ReflectionsPanel';
import { useReflections } from '@/hooks/useReflections';

export function CapturePage() {
  const [date] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { start, end } = useMemo(() => {
    const d = new Date(date);
    return {
      start: format(startOfMonth(d), 'yyyy-MM-dd'),
      end: format(endOfMonth(d), 'yyyy-MM-dd'),
    };
  }, [date]);

  const {
    config,
    reflections,
    affirmation,
    // loading,
    saveDay: saveReflection,
    saveAffirmationValue,
  } = useReflections(start, end);

  const handleFieldChange = useCallback(
    (dateStr: string, fieldId: string, value: string) => {
      const dayReflections = { ...reflections[dateStr], [fieldId]: value };
      saveReflection(dateStr, dayReflections);
    },
    [reflections, saveReflection],
  );

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="mb-4 text-2xl font-bold text-content">Capture</h1>
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
