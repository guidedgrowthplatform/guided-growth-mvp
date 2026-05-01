import { format } from 'date-fns';
import { isEditorEmpty } from '@/components/reflections/editorUtils';
import { RichTextEditor } from '@/components/reflections/RichTextEditor';

interface FreeformTabProps {
  title: string;
  body: string;
  onTitleChange: (v: string) => void;
  onBodyChange: (html: string) => void;
  onSave: () => void;
  saving: boolean;
  userName: string;
  now: Date;
}

export function FreeformTab({
  title,
  body,
  onTitleChange,
  onBodyChange,
  onSave,
  saving,
  userName,
  now,
}: FreeformTabProps) {
  const empty = isEditorEmpty(body);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-content-secondary">
        {format(now, 'EEEE, MMMM d')} &middot; {format(now, 'hh:mm a')}
      </p>

      <input
        className="w-full border-none bg-transparent text-2xl font-bold leading-tight text-content placeholder:text-content-tertiary focus:outline-none"
        placeholder="Title (Optional)"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        aria-label="Reflection title"
      />

      <p className="text-base font-bold text-content">
        What&apos;s on your mind today, {userName}?
      </p>

      <RichTextEditor value={body} onChange={onBodyChange} placeholder="Type here..." />

      <button
        type="button"
        onClick={onSave}
        disabled={empty || saving}
        className="mt-2 w-full rounded-full bg-primary px-6 py-4 text-base font-semibold text-white shadow-sm transition-opacity active:bg-primary/90 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
