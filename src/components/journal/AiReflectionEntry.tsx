import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { RichTextToolbar } from './RichTextToolbar';
import { VoiceInputBar } from './VoiceInputBar';

interface AiReflectionEntryProps {
  answer: string;
  onAnswerChange: (value: string) => void;
  onDone: () => void;
  onBack: () => void;
  userName: string;
}

export function AiReflectionEntry({
  answer,
  onAnswerChange,
  onDone,
  onBack,
  userName,
}: AiReflectionEntryProps) {
  const now = new Date();

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

      <h1 className="text-[30px] font-bold leading-tight text-content">AI Reflection</h1>
      <p className="mt-3 text-base text-content-secondary">
        {format(now, 'EEEE, MMMM d')} &middot; {format(now, 'hh:mm a')}
      </p>

      <p className="mt-6 text-base font-bold text-primary">
        What&apos;s one thing that made you smile today, {userName}?
      </p>

      <textarea
        className="mt-4 w-full flex-1 resize-none rounded-lg bg-surface-secondary p-4 text-sm font-medium text-content placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-primary/30"
        rows={6}
        placeholder="Tap the mic to answer, or start typing..."
        value={answer}
        onChange={(e) => onAnswerChange(e.target.value)}
        aria-label="AI reflection answer"
      />

      <VoiceInputBar />

      <div className="mt-2">
        <RichTextToolbar />
      </div>

      <div className="mt-auto pt-6">
        <Button variant="primary" size="auth" fullWidth disabled={!answer.trim()} onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
