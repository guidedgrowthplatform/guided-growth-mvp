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
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const lastResultIndex = event.results.length - 1;
            const lastResult = event.results[lastResultIndex];
            if (lastResult.isFinal) {
                const text = lastResult[0].transcript.trim();
                if (text) appendTranscript(text);
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            const errorMessages: Record<string, string> = {
                'not-allowed': 'Microphone access denied. Please allow microphone permissions.',
                'no-speech': 'No speech detected. Please try again.',
                'audio-capture': 'No microphone found. Please connect a microphone.',
                'network': 'Network error occurred. Please check your connection.',
                'aborted': 'Speech recognition was aborted.',
            };
            setError(errorMessages[event.error] || `Speech recognition error: ${event.error}`);
        };

        recognition.onend = () => {
            // Auto-restart if still in listening mode (handles browser auto-stop)
            const state = useVoiceStore.getState();
            if (state.isListening) {
                try {
                    recognition.start();
                } catch {
                    stopListening();
                }
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

        const recognition = getRecognition();
        if (!recognition) {
            setError('Failed to initialize speech recognition.');
            return;
        }

        try {
            recognition.start();
            startListening();
        } catch (err) {
            setError(`Failed to start speech recognition: ${err}`);
        }
    }, [isSupported, getRecognition, startListening, setError]);

    const stop = useCallback(() => {
        const recognition = recognitionRef.current;
        if (recognition) {
            try {
                recognition.stop();
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
