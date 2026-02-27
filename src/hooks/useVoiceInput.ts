'use client';

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

        if (typeof window === 'undefined') return null;

        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) return null;

        const recognition = new SpeechRecognition();
        recognition.continuous = false; // Use single-shot mode for better compatibility
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isStartingRef.current = false;
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const lastResultIndex = event.results.length - 1;
            const lastResult = event.results[lastResultIndex];
            if (lastResult.isFinal) {
                const text = lastResult[0].transcript.trim();
                if (text) appendTranscript(text);
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            isStartingRef.current = false;
            const errorMessages: Record<string, string> = {
                'not-allowed': 'Microphone access denied. Please allow microphone permissions in your browser settings.',
                'no-speech': 'No speech detected. Please try again.',
                'audio-capture': 'No microphone found. Please connect a microphone.',
                'network': 'Network error occurred. Please check your connection.',
                'aborted': '', // Don't show error for intentional aborts
                'service-not-available': 'Speech recognition service is not available. Try Chrome or Edge browser.',
            };

            const errorMsg = errorMessages[event.error];
            if (errorMsg === '') {
                // Silently ignore aborted errors
                return;
            }

            setError(errorMsg || `Speech recognition error: ${event.error}`);

            // Stop listening on critical errors
            if (event.error === 'not-allowed' || event.error === 'audio-capture' || event.error === 'service-not-available') {
                stopListening();
            }
        };

        recognition.onend = () => {
            isStartingRef.current = false;
            // Auto-restart if still in listening mode (handles browser auto-stop)
            const state = useVoiceStore.getState();
            if (state.isListening) {
                // Small delay before restarting to avoid rapid restart loops
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

        // Prevent double-start
        if (isStartingRef.current) return;

        const recognition = getRecognition();
        if (!recognition) {
            setError('Failed to initialize speech recognition.');
            return;
        }

        // Reset any previous error
        setError('');

        try {
            // Abort any existing session first
            try {
                recognition.abort();
            } catch {
                // Ignore
            }

            isStartingRef.current = true;
            recognition.start();
            startListening();
        } catch (err) {
            isStartingRef.current = false;
            if (err instanceof DOMException && err.name === 'InvalidStateError') {
                // Already started - just update state
                startListening();
            } else {
                setError(`Failed to start speech recognition: ${err instanceof Error ? err.message : err}`);
            }
        }
    }, [isSupported, getRecognition, startListening, setError]);

    const stop = useCallback(() => {
        isStartingRef.current = false;
        const recognition = recognitionRef.current;
        if (recognition) {
            try {
                recognition.abort();
            } catch {
                // Ignore errors when stopping
            }
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

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isStartingRef.current = false;
            const recognition = recognitionRef.current;
            if (recognition) {
                try {
                    recognition.abort();
                } catch {
                    // Ignore
                }
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
