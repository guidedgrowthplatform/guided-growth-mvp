import { Icon } from '@iconify/react';
import type { Editor } from '@tiptap/react';
import { useRef, useState } from 'react';
import { uploadJournalImage } from '@/api/storage';
import { ImageCropModal } from './ImageCropModal';

interface RichTextToolbarProps {
  editor: Editor | null;
  onError?: (message: string) => void;
}

const tools = [
  { icon: 'mdi:format-bold', label: 'Bold', command: 'bold' },
  { icon: 'mdi:format-italic', label: 'Italic', command: 'italic' },
  { icon: 'mdi:format-list-bulleted', label: 'Bullet list', command: 'bulletList' },
  { icon: 'mdi:minus', label: 'Horizontal rule', command: 'horizontalRule' },
];

export function RichTextToolbar({ editor, onError }: RichTextToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  if (!editor) return null;

  const handleCommand = (command: string) => {
    switch (command) {
      case 'bold':
        editor.chain().focus().toggleBold().run();
        break;
      case 'italic':
        editor.chain().focus().toggleItalic().run();
        break;
      case 'bulletList':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'horizontalRule':
        editor.chain().focus().setHorizontalRule().run();
        break;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setCropFile(file);
  };

  const handleCroppedUpload = async (selectedFile: File) => {
    try {
      const url = await uploadJournalImage(selectedFile);
      setCropFile(null);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      setCropFile(null);
      onError?.(err instanceof Error ? err.message : 'Image upload failed');
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        {tools.map((t) => (
          <button
            key={t.command}
            type="button"
            onClick={() => handleCommand(t.command)}
            aria-label={t.label}
            aria-pressed={t.command !== 'horizontalRule' ? editor.isActive(t.command) : undefined}
            className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
              t.command !== 'horizontalRule' && editor.isActive(t.command)
                ? 'bg-primary/15 text-primary'
                : 'text-content-secondary hover:bg-surface hover:text-content'
            }`}
          >
            <Icon icon={t.icon} width={20} height={20} />
          </button>
        ))}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Insert image"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-content-secondary transition-colors hover:bg-surface hover:text-content"
        >
          <Icon icon="mdi:image-outline" width={20} height={20} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      <ImageCropModal
        file={cropFile}
        onConfirm={handleCroppedUpload}
        onClose={() => setCropFile(null)}
      />
    </>
  );
}
