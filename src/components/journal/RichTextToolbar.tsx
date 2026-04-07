import { Icon } from '@iconify/react';

const tools = [
  { icon: 'mdi:format-bold', label: 'Bold' },
  { icon: 'mdi:format-italic', label: 'Italic' },
  { icon: 'mdi:format-list-bulleted', label: 'List' },
  { icon: 'mdi:minus', label: 'Horizontal rule' },
  { icon: 'mdi:image-outline', label: 'Image' },
];

export function RichTextToolbar() {
  return (
    <div className="flex items-center gap-2 rounded-md bg-surface-secondary px-6 py-3">
      {tools.map((t) => (
        <button
          key={t.icon}
          type="button"
          aria-label={t.label}
          className="flex h-10 w-10 items-center justify-center rounded-md text-content-secondary transition-colors hover:bg-surface hover:text-content"
        >
          <Icon icon={t.icon} width={20} height={20} />
        </button>
      ))}
    </div>
  );
}
