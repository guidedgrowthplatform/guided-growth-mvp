import { format } from 'date-fns';

const PROMPTS = [
  'What are the things you are grateful for today?',
  'What are the things you are proud of today?',
  'What are the things you forgive yourself for today?',
];

interface GuidedTabProps {
  answers: Record<string, string>;
  onAnswerChange: (index: number, value: string) => void;
  onSave: () => void;
  saving: boolean;
  now: Date;
}

export function GuidedTab({ answers, onAnswerChange, onSave, saving, now }: GuidedTabProps) {
  const hasContent = Object.values(answers).some((v) => v.trim());

  return (
    <div className="flex flex-col gap-6">
      <p className="text-base text-content-secondary">
        {format(now, 'EEEE, MMMM d')} &middot; {format(now, 'hh:mm a')}
      </p>

      <div className="flex flex-col gap-6">
        {PROMPTS.map((question, i) => (
          <div key={i}>
            <p className="text-base font-bold text-content">
              {i + 1}. {question}
            </p>
            <textarea
              className="mt-2 w-full resize-none rounded-lg border-none bg-surface-secondary p-4 text-sm font-medium text-content placeholder:text-content-tertiary focus:outline-none focus:ring-0"
              rows={3}
              placeholder="Type here..."
              value={answers[String(i)] ?? ''}
              onChange={(e) => onAnswerChange(i, e.target.value)}
              aria-label={`Answer for: ${question}`}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={!hasContent || saving}
        className="mt-2 w-full rounded-full bg-primary px-6 py-4 text-base font-semibold text-white shadow-sm transition-opacity active:bg-primary/90 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
