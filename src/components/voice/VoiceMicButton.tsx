import { useVoiceInput } from '@/hooks/useVoiceInput';
import { unlockTTS } from '@/lib/services/tts-service';

export function VoiceMicButton() {
  const { isListening, isSupported, error, toggle } = useVoiceInput();

  const handleTap = () => {
    unlockTTS(); // Unlock iOS speechSynthesis on user gesture
    toggle();
  };

  return (
    <button
      id="voice-mic-button"
      onClick={handleTap}
      disabled={!isSupported}
      aria-label={isListening ? 'Stop listening' : 'Start listening'}
      title={
        !isSupported
          ? 'Voice input not supported in this browser'
          : isListening
            ? 'Tap to stop listening'
            : 'Tap to start voice input'
      }
      className={`fixed bottom-28 right-4 z-50 flex h-12 w-12 cursor-pointer select-none items-center justify-center rounded-full shadow-lg transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 sm:h-14 sm:w-14 lg:bottom-6 lg:right-6 ${
        !isSupported
          ? 'cursor-not-allowed bg-content-tertiary opacity-50'
          : isListening
            ? 'bg-danger shadow-2xl shadow-danger/50 hover:bg-danger/90 focus:ring-danger'
            : error
              ? 'bg-warning hover:bg-warning/90 focus:ring-warning'
              : 'bg-primary hover:scale-105 hover:bg-primary-dark hover:shadow-xl focus:ring-primary'
      } `}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-6 w-6 text-white transition-transform duration-200 ${isListening ? 'scale-110' : ''}`}
      >
        {isListening ? (
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
        ) : (
          <>
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </>
        )}
      </svg>

      {/* Pulsing ring animation when listening */}
      {isListening && (
        <>
          <span className="absolute inset-0 animate-ping rounded-full bg-danger opacity-20" />
          <span className="absolute inset-[-4px] animate-pulse rounded-full border-2 border-danger/60 opacity-60" />
        </>
      )}
    </button>
  );
}
