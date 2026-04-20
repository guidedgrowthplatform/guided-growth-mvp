import { IconChatText } from '@/components/icons';

interface OpenChatButtonProps {
  onPress: () => void;
}

export function OpenChatButton({ onPress }: OpenChatButtonProps) {
  return (
    <button
      onClick={onPress}
      className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-white px-[17px] py-[7px] shadow-sm transition-shadow hover:shadow-md"
    >
      <span className="text-xs font-bold tracking-[0.3px] text-primary">Open Chat</span>
      <IconChatText size={20} className="text-primary" />
    </button>
  );
}
