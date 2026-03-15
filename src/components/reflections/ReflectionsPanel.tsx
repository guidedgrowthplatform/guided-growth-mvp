import type { ReflectionConfig, DayReflections } from '@shared/types';
import { ReflectionField } from './ReflectionField';
import { AffirmationField } from './AffirmationField';

interface ReflectionsPanelProps {
  date: string;
  config: ReflectionConfig | null;
  reflections: Record<string, DayReflections>;
  affirmation: string;
  onFieldChange: (date: string, fieldId: string, value: string) => void;
  onAffirmationChange: (value: string) => void;
}

export function ReflectionsPanel({
  date, config, reflections, affirmation,
  onFieldChange, onAffirmationChange,
}: ReflectionsPanelProps) {
  if (!config) return null;

  const dayReflections = reflections[date] || {};

  return (
    <div className="space-y-4 mt-6">
      <h3 className="text-lg font-bold text-content">Reflections</h3>

      {config.fields
        .sort((a, b) => a.order - b.order)
        .map((field) => (
          <ReflectionField
            key={field.id}
            field={field}
            value={dayReflections[field.id] || ''}
            onChange={(fieldId, value) => onFieldChange(date, fieldId, value)}
          />
        ))}

      {config.show_affirmation && (
        <AffirmationField value={affirmation} onChange={onAffirmationChange} />
      )}
    </div>
  );
}
