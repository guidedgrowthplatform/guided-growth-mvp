import { useEffect, useRef, useCallback } from 'react';
import { useVoiceStore } from '@/stores/voiceStore';

// Extend Window interface for webkit prefix
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition: new () => SpeechRecognitionInstance;
    }
}

export function useVoiceInput() {
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const isStartingRef = useRef(false);
    const {
        isListening,
        transcript,
        error,
        isSupported,
        startListening,
        stopListening,
        appendTranscript,
        setError,
        resetTranscript,
        setSupported,
    } = useVoiceStore();

    // Check browser support on mount
    useEffect(() => {
        const supported =
            typeof window !== 'undefined' &&
            ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
        setSupported(supported);
    }, [setSupported]);

    // Initialize recognition instance
    const getRecognition = useCallback(() => {
        if (recognitionRef.current) return recognitionRef.current;

        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) return null;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = '';  // auto-detect language (supports English + Indonesian)

        recognition.onstart = () => {
            isStartingRef.current = false;
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    const text = result[0].transcript.trim();
                    if (text) appendTranscript(text);
                }
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            isStartingRef.current = false;
            const errorMessages: Record<string, string> = {
                'not-allowed': 'Microphone access denied. Please allow microphone permissions.',
                'no-speech': '',  // silently restart — don't show error
                'audio-capture': 'No microphone found. Please connect a microphone.',
                'network': 'Network error. Please check your connection.',
                'aborted': '',
                'service-not-available': 'Speech recognition not available. Try Chrome or Edge.',
            };

            const errorMsg = errorMessages[event.error];
            if (errorMsg === '') return;

            setError(errorMsg || `Speech recognition error: ${event.error}`);

            if (['not-allowed', 'audio-capture', 'service-not-available'].includes(event.error)) {
                stopListening();
            }
        };

        recognition.onend = () => {
            isStartingRef.current = false;
            const state = useVoiceStore.getState();
            if (state.isListening) {
                setTimeout(() => {
                    const currentState = useVoiceStore.getState();
                    if (currentState.isListening && !isStartingRef.current) {
                        try {
                            isStartingRef.current = true;
                            recognition.start();
                        } catch {
                            isStartingRef.current = false;
                            stopListening();
                        }
                    }
                }, 100);
            }
        };

        recognitionRef.current = recognition;
        return recognition;
    }, [appendTranscript, setError, stopListening]);

    const start = useCallback(() => {
        if (!isSupported) {
            setError('Web Speech API is not supported in this browser. Try Chrome or Edge.');
            return;
        }

        if (isStartingRef.current) return;

        const recognition = getRecognition();
        if (!recognition) {
            setError('Failed to initialize speech recognition.');
            return;
        }

        setError('');

        try {
            try { recognition.abort(); } catch { /* ignore */ }
            isStartingRef.current = true;
            recognition.start();
            startListening();
        } catch (err) {
            isStartingRef.current = false;
            if (err instanceof DOMException && err.name === 'InvalidStateError') {
                startListening();
            } else {
                setError(`Failed to start: ${err instanceof Error ? err.message : err}`);
            }
        }
    }, [isSupported, getRecognition, startListening, setError]);

    const stop = useCallback(() => {
        isStartingRef.current = false;
        const recognition = recognitionRef.current;
        if (recognition) {
            try { recognition.abort(); } catch { /* ignore */ }
        }
        stopListening();
    }, [stopListening]);

    const toggle = useCallback(() => {
        if (isListening) {
            stop();
        } else {
            start();
        }
    }, [isListening, start, stop]);

    useEffect(() => {
        return () => {
            isStartingRef.current = false;
            const recognition = recognitionRef.current;
            if (recognition) {
                try { recognition.abort(); } catch { /* ignore */ }
                recognitionRef.current = null;
            }
        };
    }, []);

    return {
        isListening,
        transcript,
        error,
        isSupported,
        start,
        stop,
        toggle,
        resetTranscript,
    };
}
