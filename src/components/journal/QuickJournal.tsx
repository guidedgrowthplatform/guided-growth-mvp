import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface QuickJournalProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  isSaving?: boolean;
  placeholder?: string;
  prompts?: string[];
}

export function QuickJournal({ value, onChange, onSave, isSaving, placeholder = 'How was your day?', prompts }: QuickJournalProps) {
  return (
    <Card padding="lg">
      {prompts && prompts.length > 0 && (
        <div className="mb-3 space-y-1">
          {prompts.map((prompt, i) => (
            <p key={i} className="text-sm text-content-secondary">{prompt}</p>
          ))}
        </div>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface-secondary border-none rounded-md resize-none min-h-[120px] p-3 text-sm text-content outline-none focus:ring-2 focus:ring-primary"
      />
      <Button
        variant="primary"
        fullWidth
        className="mt-3"
        onClick={onSave}
        disabled={isSaving || !value.trim()}
      >
        {isSaving ? 'Saving...' : 'Save'}
      </Button>
    </Card>
  );
}
