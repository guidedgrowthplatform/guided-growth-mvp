import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { RichTextToolbar } from './RichTextToolbar';

interface FreeformEntryProps {
  title: string;
  body: string;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSave: () => void;
  onBack: () => void;
  userName: string;
}

export function FreeformEntry({
  title,
  body,
  onTitleChange,
  onBodyChange,
  onSave,
  onBack,
  userName,
}: FreeformEntryProps) {
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

      <h1 className="text-[30px] font-bold leading-tight text-content">Freeform Reflection</h1>
      <p className="mt-3 text-base text-content-secondary">
        {format(now, 'EEEE, MMMM d')} &middot; {format(now, 'hh:mm a')}
      </p>

      <input
        className="mt-6 w-full border-none bg-transparent text-[30px] font-bold leading-tight text-content placeholder:text-content-tertiary focus:outline-none"
        placeholder="Title (Optional)"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        aria-label="Reflection title"
      />

      <p className="mt-2 text-base font-bold text-content">
        What&apos;s on your mind today, {userName}? Type or tap the mic to speak
      </p>

      <textarea
        className="mt-4 w-full flex-1 resize-none rounded-lg bg-surface-secondary p-4 text-sm font-medium text-content placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-primary/30"
        rows={8}
        placeholder="Type here..."
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        aria-label="Freeform reflection"
      />

      <div className="mt-4">
        <RichTextToolbar />
      </div>

      <div className="mt-auto pt-6">
        <Button variant="primary" size="auth" fullWidth disabled={!body.trim()} onClick={onSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
