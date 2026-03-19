import { Icon } from '@iconify/react';
import { Mic } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface VoiceCheckInOverlayProps {
  onClose: () => void;
}

type VoiceState = 'idle' | 'listening' | 'processing';

const stateLabel: Record<VoiceState, string> = {
  idle: 'Tap to speak',
  listening: 'Listening',
  processing: 'Thinking...',
};

const stateMessage: Record<VoiceState, string> = {
  idle: 'Hi there! how are you feeling right now regarding your energy, mood, or stress?',
  listening: "I'm listening — tell me how you're feeling today.",
  processing: 'Processing what you said...',
};

export function VoiceCheckInOverlay({ onClose }: VoiceCheckInOverlayProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleMicPress = () => {
    if (state === 'idle') {
      setState('listening');
    } else if (state === 'listening') {
      setState('processing');
      timerRef.current = setTimeout(() => setState('idle'), 2000);
    }
  };

  const pillBg = state === 'listening' ? 'bg-[#fdd017]' : 'bg-primary';
  const pillText = state === 'listening' ? 'text-content' : 'text-white';
  const showSpinner = state !== 'idle';

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(4,4,4,0.55)] via-[rgba(26,26,26,0.4)] to-[rgba(81,81,81,0.25)]" />
      <div
        className="absolute inset-0 backdrop-blur-[15px]"
        style={{ maskImage: 'linear-gradient(to bottom, transparent 20%, black 60%)' }}
      />

      <div
        className="relative z-10 flex flex-1 flex-col items-center justify-end px-5 pb-28"
        onClick={(e) => e.stopPropagation()}
      >
        {/* State pill */}
        <div className={`flex items-center gap-2 rounded-[10px] px-3 py-1.5 ${pillBg}`}>
          <span className={`text-[14px] font-medium ${pillText}`}>{stateLabel[state]}</span>
          {showSpinner && (
            <Icon icon="mingcute:loading-2-line" className={`h-6 w-6 animate-spin ${pillText}`} />
          )}
        </div>

        {/* Chat message */}
        <p className="mt-5 max-w-[227px] text-center text-[14px] font-medium leading-[22px] text-white">
          {stateMessage[state]}
        </p>

        {/* Mic button with rings */}
        <div className="mt-12">
          <div className="relative flex items-center justify-center">
            {/* Outer ring */}
            <div
              className={`absolute h-[120px] w-[120px] rounded-full border-[3px] border-[#89c9ff] opacity-40 shadow-[0px_4px_16px_0px_rgba(65,105,225,0.2)] transition-all duration-500 ${
                state === 'listening' ? 'animate-[pulse_1.5s_ease-in-out_infinite]' : ''
              }`}
            />
            {/* Inner ring */}
            <div
              className={`absolute h-[105px] w-[105px] rounded-full border-[3px] border-[#89c9ff] opacity-40 shadow-[0px_4px_16px_0px_rgba(65,105,225,0.2)] transition-all duration-500 ${
                state === 'listening' ? 'animate-[pulse_1.5s_ease-in-out_infinite_0.3s]' : ''
              }`}
            />
            {/* Mic button */}
            <button
              onClick={handleMicPress}
              disabled={state === 'processing'}
              className="relative flex h-[75px] w-[75px] items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark shadow-[0px_0px_15px_0px_rgba(19,91,236,0.3)] active:scale-95 disabled:active:scale-100"
            >
              <Mic className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
