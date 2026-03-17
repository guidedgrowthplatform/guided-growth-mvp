import { useCallback, useRef } from 'react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { unlockTTS } from '@/lib/services/tts-service';

export function VoiceMicButton() {
    const { isListening, isSupported, error, toggle } = useVoiceInput();
    const handledRef = useRef(false);

    // Use onPointerDown for immediate response on iOS (no 300ms tap delay)
    // unlockTTS() MUST fire on user gesture to satisfy iOS activation requirement
    const handlePointerDown = useCallback(() => {
        unlockTTS();
        handledRef.current = true;
        toggle();
    }, [toggle]);

    // Fallback for devices that don't fire pointer events (accessibility, keyboard)
    const handleClick = useCallback(() => {
        if (handledRef.current) {
            handledRef.current = false;
            return; // Already handled by pointerdown
        }
        unlockTTS();
        toggle();
    }, [toggle]);

    return (
        <button
            id="voice-mic-button"
            onPointerDown={handlePointerDown}
            onClick={handleClick}
            disabled={!isSupported}
            aria-label={isListening ? 'Stop listening' : 'Start listening'}
            title={
                !isSupported
                    ? 'Voice input not supported in this browser'
                    : isListening
                        ? 'Tap to stop listening'
                        : 'Tap to start voice input'
            }
            style={{ bottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
            className={`
                fixed right-4 z-50 lg:bottom-6 lg:right-6
                w-12 h-12 sm:w-14 sm:h-14 rounded-full
                flex items-center justify-center
                shadow-lg transition-all duration-300 ease-in-out
                cursor-pointer select-none
                focus:outline-none focus:ring-4
                ${!isSupported
                    ? 'bg-gray-400 cursor-not-allowed opacity-50'
                    : isListening
                        ? 'bg-red-500 hover:bg-red-600 focus:ring-red-300 shadow-red-500/50 shadow-2xl'
                        : error
                            ? 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-300'
                            : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 focus:ring-indigo-300 hover:shadow-xl hover:scale-105'
                }
            `}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`w-6 h-6 text-white transition-transform duration-200 ${isListening ? 'scale-110' : ''}`}
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
                    <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20" />
                    <span className="absolute inset-[-4px] rounded-full border-2 border-red-400 animate-pulse opacity-60" />
                </>
            )}
        </button>
    );
}
