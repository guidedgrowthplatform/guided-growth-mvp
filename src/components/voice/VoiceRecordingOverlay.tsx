import { Icon } from '@iconify/react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceStore } from '@/stores/voiceStore';
import { VoiceCommandTips } from './VoiceCommandTips';

interface VoiceRecordingOverlayProps {
  onClose: () => void;
}

export function VoiceRecordingOverlay({ onClose }: VoiceRecordingOverlayProps) {
  const { transcript, interim, toggle } = useVoiceInput();
  const isListening = useVoiceStore((s) => s.isListening);

  const handleClose = () => {
    if (isListening) toggle();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ backgroundColor: '#0F172A' }}>
      <div className="flex justify-end p-4">
        <button
          onClick={handleClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white transition-colors hover:bg-white/90"
        >
          <Icon icon="ic:round-close" width={22} className="text-slate-900" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {transcript && (
          <div className="mx-auto max-w-sm">
            <p className="mb-1 text-xs text-white/60">You</p>
            <div className="rounded-2xl bg-white/10 px-5 py-4">
              <p className="text-lg font-medium text-white">{transcript}</p>
            </div>
          </div>
        )}
        {interim && <p className="mt-4 text-center text-sm font-medium text-white/50">{interim}</p>}
      </div>

      <div className="flex flex-col items-center gap-4 pb-8">
        <VoiceCommandTips />

        <div className="relative flex items-center justify-center">
          {isListening && (
            <>
              <span className="absolute h-[180px] w-[180px] animate-pulse rounded-full bg-primary/20" />
              <span
                className="absolute h-[140px] w-[140px] animate-pulse rounded-full bg-primary/40"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="absolute h-[110px] w-[110px] animate-pulse rounded-full bg-primary/60"
                style={{ animationDelay: '300ms' }}
              />
            </>
          )}
          <button
            onClick={() => toggle()}
            className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-primary transition-transform hover:scale-105"
            style={{ boxShadow: '0 0 40px rgba(19,91,236,0.6)' }}
          >
            <Icon
              icon={isListening ? 'ic:round-stop' : 'ic:round-mic'}
              width={29}
              className="text-white"
            />
          </button>
        </div>

        <p className="text-sm font-medium text-white">
          {isListening ? 'Listening...' : 'Tap to speak'}
        </p>
      </div>
    </div>
  );
}
