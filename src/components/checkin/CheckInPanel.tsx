import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type CheckInDimension = 'sleep' | 'mood' | 'energy' | 'stress';

interface CheckInPanelProps {
  values: Record<CheckInDimension, number | null>;
  onChange: (dimension: CheckInDimension, value: number) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

const dimensionConfig: Record<CheckInDimension, { label: string; emojis: string[] }> = {
  sleep:  { label: 'Sleep',  emojis: ['😴', '💤', '😐', '😊', '⭐'] },
  mood:   { label: 'Mood',   emojis: ['😢', '😕', '😐', '😊', '😄'] },
  energy: { label: 'Energy', emojis: ['🪫', '😮‍💨', '😐', '💪', '⚡'] },
  stress: { label: 'Stress', emojis: ['😰', '😟', '😐', '😌', '🧘'] },
};

const dimensions: CheckInDimension[] = ['sleep', 'mood', 'energy', 'stress'];

export function CheckInPanel({ values, onChange, onSubmit, isSubmitting }: CheckInPanelProps) {
  return (
    <Card padding="lg">
      <h3 className="text-lg font-bold text-content mb-4">Daily Check-In</h3>
      <div className="space-y-4">
        {dimensions.map((dim) => {
          const config = dimensionConfig[dim];
          return (
            <div key={dim}>
              <p className="text-sm font-medium text-content-secondary mb-2">{config.label}</p>
              <div className="flex gap-2">
                {config.emojis.map((emoji, i) => {
                  const val = i + 1;
                  const isSelected = values[dim] === val;
                  return (
                    <button
                      key={val}
                      onClick={() => onChange(dim, val)}
                      className={`flex-1 py-2 text-xl rounded-lg transition-all ${
                        isSelected
                          ? 'bg-primary/10 ring-2 ring-primary'
                          : 'bg-surface-secondary hover:bg-surface-secondary'
                      }`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <Button
        variant="primary"
        size="xl"
        fullWidth
        className="mt-6"
        onClick={onSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Saving...' : 'Save Check-In'}
      </Button>
    </Card>
  );
}
