import { Icon } from '@iconify/react';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { MoodStrip } from '@/components/reflections';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceStore } from '@/stores/voiceStore';
import { RichTextToolbar } from './RichTextToolbar';
import '@/styles/tiptap.css';

interface FreeformEntryProps {
  initialBody: string;
  title: string;
  onTitleChange: (value: string) => void;
  onSave: (body: string) => void;
  onBack: () => void;
  userName: string;
  saving?: boolean;
  mood?: string | null;
  onMoodChange?: (mood: string | null) => void;
}

export function FreeformEntry({
  initialBody,
  title,
  onTitleChange,
  onSave,
  onBack,
  userName,
  saving,
  mood = null,
  onMoodChange,
}: FreeformEntryProps) {
  const now = new Date();
  const { addToast } = useToast();
  const [hasContent, setHasContent] = useState(!!initialBody);
  const { isListening, isPreparing, toggle: toggleVoice, error: voiceError } = useVoiceInput();
  const resetTranscript = useVoiceStore((s) => s.resetTranscript);
  const transcript = useVoiceStore((s) => s.transcript);

  const editor = useEditor({
    extensions: [StarterKit, Image, Placeholder.configure({ placeholder: 'Type here...' })],
    content: initialBody || '',
    immediatelyRender: false,
    onCreate: ({ editor }) => {
      setHasContent(!editor.isEmpty);
    },
    onUpdate: ({ editor }) => {
      setHasContent(!editor.isEmpty);
    },
    editorProps: {
      attributes: {
        'aria-label': 'Freeform reflection',
        role: 'textbox',
        'aria-multiline': 'true',
        class: 'px-4 py-3 text-sm font-medium text-content focus:outline-none',
      },
      // Strip external styles on paste, keep structure (paragraphs, bold, italic, lists)
      transformPastedHTML(html) {
        const ALLOWED = ['P', 'STRONG', 'EM', 'B', 'I', 'UL', 'OL', 'LI', 'BR', 'HR'];
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const clean = (node: Node): string => {
          if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
          if (node.nodeType !== Node.ELEMENT_NODE) return '';
          const el = node as Element;
          const tag = el.tagName;
          const inner = Array.from(el.childNodes).map(clean).join('');
          if (ALLOWED.includes(tag)) return `<${tag.toLowerCase()}>${inner}</${tag.toLowerCase()}>`;
          return inner;
        };
        return clean(doc.body);
      },
    },
  });

  // When a new transcript arrives from the voice service, append it to
  // the editor content at the current caret position. Uses Tiptap's
  // insertContent so the text lands inside the current block (paragraph
  // or list item) rather than as a new top-level node.
  useEffect(() => {
    if (!transcript || !editor || isListening) return;
    const trimmed = transcript.trim();
    if (!trimmed) return;
    // Insert with a leading space if we're not at the very start.
    const prefix = editor.isEmpty ? '' : ' ';
    editor
      .chain()
      .focus()
      .insertContent(prefix + trimmed)
      .run();
    resetTranscript();
  }, [transcript, isListening, editor, resetTranscript]);

  // Surface voice errors as toasts.
  useEffect(() => {
    if (voiceError) addToast('error', voiceError);
  }, [voiceError, addToast]);

  const handleSave = () => {
    onSave(editor?.getHTML() ?? '');
  };

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
        className="mt-6 w-full border-none bg-transparent text-2xl font-bold leading-tight text-content placeholder:text-content-tertiary focus:outline-none"
        placeholder="Title (Optional)"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        aria-label="Reflection title"
      />

      {onMoodChange && (
        <div className="mt-4">
          <MoodStrip value={mood} onChange={onMoodChange} />
        </div>
      )}

      <p className="mt-4 text-base font-bold text-content">
        What&apos;s on your mind today, {userName}?
      </p>

      <div className="mt-4 rounded-lg bg-surface-secondary">
        <EditorContent editor={editor} />
      </div>

      <div className="mt-3 rounded-lg bg-surface-secondary px-2 py-1">
        <RichTextToolbar editor={editor} onError={(msg) => addToast('error', msg)} />
      </div>

      {/* Voice input button — dictates text into the editor at caret. */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={toggleVoice}
          disabled={isPreparing}
          aria-label={isListening ? 'Stop recording' : 'Dictate with voice'}
          className={`flex size-[56px] items-center justify-center rounded-full text-white shadow-lg transition-all disabled:opacity-70 ${
            isListening ? 'animate-pulse bg-red-500' : 'bg-primary'
          }`}
        >
          <Icon
            icon={
              isPreparing
                ? 'mingcute:loading-2-line'
                : isListening
                  ? 'ic:round-stop'
                  : 'ic:round-mic'
            }
            width={24}
            height={24}
            className={isPreparing ? 'animate-spin' : ''}
          />
        </button>
        <span className="text-sm font-medium text-content-secondary">
          {isPreparing
            ? 'Preparing mic...'
            : isListening
              ? 'Listening — tap to stop'
              : 'Or dictate with voice'}
        </span>
      </div>

      <div className="mt-auto pt-6">
        <Button
          variant="primary"
          size="auth"
          fullWidth
          disabled={!hasContent || saving}
          onClick={handleSave}
        >
          {saving ? 'Saving\u2026' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
