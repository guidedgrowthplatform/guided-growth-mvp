import { Icon } from '@iconify/react';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { format } from 'date-fns';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
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
}

export function FreeformEntry({
  initialBody,
  title,
  onTitleChange,
  onSave,
  onBack,
  userName,
  saving,
}: FreeformEntryProps) {
  const now = new Date();
  const { addToast } = useToast();
  const [hasContent, setHasContent] = useState(!!initialBody);

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

      <p className="mt-2 text-base font-bold text-content">
        What&apos;s on your mind today, {userName}?
      </p>

      <div className="mt-4 rounded-lg bg-surface-secondary">
        <EditorContent editor={editor} />
      </div>

      <div className="mt-3 rounded-lg bg-surface-secondary px-2 py-1">
        <RichTextToolbar editor={editor} onError={(msg) => addToast('error', msg)} />
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
