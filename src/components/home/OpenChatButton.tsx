import { IconChatText } from '@/components/icons';

interface OpenChatButtonProps {
  onPress: () => void;
  floating?: boolean;
}

export function OpenChatButton({ onPress, floating = false }: OpenChatButtonProps) {
  const positioning = floating
    ? 'absolute right-6 bottom-[calc(120px+env(safe-area-inset-bottom))] z-30 shadow-md hover:shadow-lg'
    : 'shadow-sm hover:shadow-md';
  return (
    <button
      onClick={onPress}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border-light bg-white px-[17px] py-[7px] transition-shadow ${positioning}`}
    >
      <span className="text-xs font-bold tracking-[0.3px] text-primary">Open Chat</span>
      <IconChatText size={20} className="text-primary" />
    </button>
  );
}
