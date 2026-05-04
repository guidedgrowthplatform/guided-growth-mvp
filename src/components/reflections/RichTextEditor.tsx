import { Icon } from '@iconify/react';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef, useState } from 'react';
import { apiPost } from '@/api/client';
import { useToast } from '@/contexts/ToastContext';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Vercel function body limit is 4.5MB; base64 inflates ~33%, so cap raw at 2.5MB
const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024;

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

async function uploadImage(file: File): Promise<string> {
  const data = await fileToBase64(file);
  const res = await apiPost<{ url: string }>('/api/reflections/journal?action=upload', {
    data,
    contentType: file.type,
  });
  return res.url;
}

function ToolbarButton({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
        active ? 'bg-primary/10 text-primary' : 'text-content-secondary'
      } hover:bg-surface-secondary active:bg-surface-secondary disabled:opacity-50`}
    >
      <Icon icon={icon} width={18} height={18} />
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { addToast } = useToast();

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      addToast('error', 'Only JPEG, PNG, or WebP images are supported');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      addToast('error', 'Image must be under 2.5 MB');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Image upload failed';
      addToast('error', msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-2xl bg-surface-secondary p-2">
      <ToolbarButton
        icon="mdi:format-bold"
        label="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon="mdi:format-italic"
        label="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon="mdi:format-list-bulleted"
        label="Bulleted list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon="mdi:minus"
        label="Divider"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />
      <ToolbarButton
        icon="mdi:image-outline"
        label="Insert image"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(',')}
        className="hidden"
        onChange={onPickImage}
      />
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Type here...',
  className = '',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class:
          'reflection-editor prose prose-sm max-w-none min-h-[300px] focus:outline-none px-4 py-4 text-content',
      },
    },
  });

  // Sync external value resets (e.g. after save)
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="rounded-2xl bg-surface-secondary">
        <EditorContent editor={editor} />
      </div>
      <Toolbar editor={editor} />
    </div>
  );
}

