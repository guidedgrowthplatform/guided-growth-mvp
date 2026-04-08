import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';

interface TemplateConfig {
  title: string;
  questions: string[];
}

const TEMPLATE_MAP: Record<string, TemplateConfig> = {
  '5-minute-morning': {
    title: '5-Minute Morning',
    questions: [
      'What are three things you are grateful for today?',
      'What is one main goal that would make today great?',
      'A daily affirmation for myself:',
    ],
  },
  'evening-wind-down': {
    title: 'Evening Wind Down',
    questions: [
      'What went well today?',
      'What is one thing I could improve tomorrow?',
      'What am I looking forward to?',
    ],
  },
  'anxiety-relief': {
    title: 'Anxiety Relief',
    questions: [
      'What am I feeling anxious about right now?',
      'What is within my control in this situation?',
      'What is one small step I can take right now?',
    ],
  },
  'daily-reflection': {
    title: 'Daily Reflection',
    questions: [
      'How am I feeling emotionally right now?',
      'What was the most meaningful moment today?',
      'What did I learn about myself today?',
    ],
  },
};

interface TemplateEntryProps {
  templateId: string;
  answers: Record<string, string>;
  onAnswerChange: (index: number, value: string) => void;
  onSave: () => void;
  onBack: () => void;
  saving?: boolean;
}

export function TemplateEntry({
  templateId,
  answers,
  onAnswerChange,
  onSave,
  onBack,
  saving,
}: TemplateEntryProps) {
  const config = TEMPLATE_MAP[templateId] ?? TEMPLATE_MAP['5-minute-morning'];
  const now = new Date();
  const hasContent = Object.values(answers).some((v) => v.trim());

  return (
    <div className="flex min-h-screen flex-col px-6 pb-8 pt-4">
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back"
        className="mb-8 self-start text-content"
      >
        <Icon icon="mdi:arrow-left" width={24} height={24} />
      </button>

      <h1 className="text-[30px] font-bold leading-tight text-content">{config.title}</h1>
      <p className="mt-3 text-base text-content-secondary">
        {format(now, 'EEEE, MMMM d')} &middot; {format(now, 'hh:mm a')}
      </p>

      <div className="mt-6 flex flex-col gap-6">
        {config.questions.map((question, i) => (
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

      {/* Inspirational quote card */}
      <div className="mt-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#EEF2FF] to-[#DBEAFE] p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Daily Inspiration
        </p>
        <p className="mt-1 text-sm text-content-secondary">
          &ldquo;The secret of your future is hidden in your daily routine.&rdquo;
        </p>
      </div>

      <div className="mt-auto pt-6">
        <Button
          variant="primary"
          size="auth"
          fullWidth
          disabled={!hasContent || saving}
          onClick={onSave}
        >
          {saving ? 'Saving\u2026' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
