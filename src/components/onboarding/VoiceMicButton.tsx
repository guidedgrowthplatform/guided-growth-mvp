import { Icon } from '@iconify/react';

interface VoiceMicButtonProps {
  isListening: boolean;
  onPress: () => void;
}

export function VoiceMicButton({ isListening, onPress }: VoiceMicButtonProps) {
  return (
    <div className="relative flex items-center justify-center">
      {isListening && (
        <>
          <div className="absolute size-[96px] animate-ping rounded-full border-2 border-[#135bec]" />
          <div className="absolute size-[96px] animate-ping rounded-full border-2 border-[#135bec] [animation-delay:0.5s]" />
        </>
      )}
      <button
        type="button"
        onClick={onPress}
        className="relative size-[96px] rounded-full bg-[#135bec] shadow-[0px_10px_15px_-3px_rgba(59,130,246,0.3),0px_4px_6px_-4px_rgba(59,130,246,0.3)]"
      >
        <Icon icon="ic:round-mic" className="mx-auto size-[36px] text-white" />
      </button>
    </div>
  );
}
