import { useEffect, useRef, useCallback } from 'react';
import { useVoiceStore } from '@/stores/voiceStore';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

// Track interim text separately so we can show live speech
let currentInterim = '';
let networkErrorCount = 0;

// Silence detection config
const SILENCE_TIMEOUT_MS = 2500; // auto-stop after 2.5s of silence (like Siri)

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
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasSpokenRef = useRef(false);
    const {
        isListening,
        transcript,
        interim,
        error,
        isSupported,
        startListening,
        stopListening,
        appendTranscript,
        setInterim,
        setError,
        resetTranscript,
        setSupported,
    } = useVoiceStore();

    // Clear silence timer
    const clearSilenceTimer = useCallback(() => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    }, []);

    // Reset silence timer — called on every speech result
    const resetSilenceTimer = useCallback(() => {
        // In 'always-on' mode, skip silence detection entirely
        const { recordingMode } = useVoiceSettingsStore.getState();
        if (recordingMode === 'always-on') {
            clearSilenceTimer();
            return;
        }

        clearSilenceTimer();
        silenceTimerRef.current = setTimeout(() => {
            // Auto-stop after silence (only if user has spoken something)
            if (hasSpokenRef.current) {
                const recognition = recognitionRef.current;
                if (recognition) {
                    try { recognition.stop(); } catch { /* ignore */ }
                }
                stopListening();
            }
        }, SILENCE_TIMEOUT_MS);
    }, [clearSilenceTimer, stopListening]);

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
        recognition.lang = navigator.language || 'en-US';  // use browser language

        recognition.onstart = () => {
            isStartingRef.current = false;
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    const text = result[0].transcript.trim();
                    if (text) {
                        currentInterim = '';
                        hasSpokenRef.current = true;
                        appendTranscript(text);
                    }
                } else {
                    interim += result[0].transcript;
                }
            }
            // Show live interim text
            if (interim) {
                currentInterim = interim;
                hasSpokenRef.current = true;
                setInterim(interim);
            }
            // Reset silence timer on any speech activity
            resetSilenceTimer();
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            isStartingRef.current = false;
            const errorMessages: Record<string, string> = {
                'not-allowed': 'Microphone access denied. Please allow microphone permissions.',
                'no-speech': '',  // silently restart
                'audio-capture': 'No microphone found. Please connect a microphone.',
                'network': '',  // handled below with adblock detection
                'aborted': '',
                'service-not-available': 'Speech recognition not available. Try Chrome or Edge.',
            };

            const errorMsg = errorMessages[event.error];
            if (errorMsg === '') {
                // Track network errors for adblock detection
                if (event.error === 'network') {
                    networkErrorCount++;
                    if (networkErrorCount >= 2) {
                        const isBrave = 'brave' in navigator;
                        setError(
                            isBrave
                                ? '⚠️ Brave Shield may block voice recognition. Please disable Shields for this site.'
                                : '⚠️ Ad blocker may block voice recognition. Please disable it for this site.'
                        );
                    }
                }
                return;
            }

            setError(errorMsg || `Speech recognition error: ${event.error}`);

            if (['not-allowed', 'audio-capture', 'service-not-available'].includes(event.error)) {
                stopListening();
                clearSilenceTimer();
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
                            clearSilenceTimer();
                        }
                    }
                }, 100);
            }
        };

        recognitionRef.current = recognition;
        return recognition;
    }, [appendTranscript, setInterim, setError, stopListening, resetSilenceTimer, clearSilenceTimer]);

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
        networkErrorCount = 0;
        hasSpokenRef.current = false;

        try {
            try { recognition.abort(); } catch { /* ignore */ }
            isStartingRef.current = true;
            recognition.start();
            startListening();
            // Start silence timer (will auto-stop if no speech detected)
            resetSilenceTimer();
        } catch (err) {
            isStartingRef.current = false;
            if (err instanceof DOMException && err.name === 'InvalidStateError') {
                startListening();
            } else {
                setError(`Failed to start: ${err instanceof Error ? err.message : err}`);
            }
        }
    }, [isSupported, getRecognition, startListening, setError, resetSilenceTimer]);

    const stop = useCallback(() => {
        isStartingRef.current = false;
        currentInterim = '';
        hasSpokenRef.current = false;
        clearSilenceTimer();
        const recognition = recognitionRef.current;
        if (recognition) {
            // Use stop() not abort() — stop() processes final result first
            try { recognition.stop(); } catch { /* ignore */ }
        }
        stopListening();
    }, [stopListening, clearSilenceTimer]);

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
            clearSilenceTimer();
            const recognition = recognitionRef.current;
            if (recognition) {
                try { recognition.abort(); } catch { /* ignore */ }
                recognitionRef.current = null;
            }
        };
    }, [clearSilenceTimer]);

    return {
        isListening,
        transcript,
        interim,
        error,
        isSupported,
        start,
        stop,
        toggle,
        resetTranscript,
    };
}
