import { useEffect, useRef, useCallback, useState } from 'react';
import { useVoiceStore } from '@/stores/voiceStore';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

// Whisper WASM (~40MB) crashes mobile Safari — block on mobile devices
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
import {
    loadWhisperModel,
    transcribeAudio,
    startAudioCapture,
    stopAudioCapture,
    onWhisperStatus,
    type WhisperStatus,
} from '@/lib/services/whisper-service';
import { ensureMicPermission } from '@/lib/services/mic-permissions';

// Track interim text separately so we can show live speech
let currentInterim = '';
let networkErrorCount = 0;
let lastFinalTimestamp = 0;

// If a new isFinal result comes >1.5s after the previous one,
// treat it as a NEW command attempt (replace, don't append).
const CHUNK_GAP_MS = 1500;
const MAX_TRANSCRIPT_LENGTH = 200;

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
    const whisperRecordingRef = useRef(false);

    const [whisperStatus, setWhisperStatus] = useState<WhisperStatus>('idle');
    const [whisperProgress, setWhisperProgress] = useState(0);

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

    // Listen to whisper status changes
    useEffect(() => {
        const unsub = onWhisperStatus((status, progress) => {
            setWhisperStatus(status);
            if (progress !== undefined) setWhisperProgress(progress);
        });
        return () => { unsub(); };
    }, []);

    // Clear silence timer
    const clearSilenceTimer = useCallback(() => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    }, []);

    // Reset silence timer — called on every speech result
    const resetSilenceTimer = useCallback(() => {
        const { recordingMode } = useVoiceSettingsStore.getState();
        if (recordingMode === 'always-on') {
            clearSilenceTimer();
            return;
        }

        clearSilenceTimer();
        silenceTimerRef.current = setTimeout(() => {
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
        const { sttProvider } = useVoiceSettingsStore.getState();
        if (sttProvider === 'whisper') {
            setSupported(true);
        } else {
            const supported =
                typeof window !== 'undefined' &&
                ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
            setSupported(supported);
        }
    }, [setSupported]);

    // ─── Web Speech API Provider ───

    const getRecognition = useCallback(() => {
        if (recognitionRef.current) return recognitionRef.current;

        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) return null;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = navigator.language || 'en-US';

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

                        const now = Date.now();
                        const gap = now - lastFinalTimestamp;
                        lastFinalTimestamp = now;

                        const currentTranscript = useVoiceStore.getState().transcript;

                        // If gap is large OR transcript is already long,
                        // treat this as a new command (replace, don't append)
                        if (gap > CHUNK_GAP_MS || currentTranscript.length > MAX_TRANSCRIPT_LENGTH) {
                            useVoiceStore.getState().setTranscript(text);
                        } else {
                            appendTranscript(text);
                        }
                    }
                } else {
                    interim += result[0].transcript;
                }
            }
            if (interim) {
                currentInterim = interim;
                hasSpokenRef.current = true;
                setInterim(interim);
            }
            resetSilenceTimer();
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            isStartingRef.current = false;
            const errorMessages: Record<string, string> = {
                'not-allowed': 'Microphone access denied. Please allow microphone permissions.',
                'no-speech': '',
                'audio-capture': 'No microphone found. Please connect a microphone.',
                'network': '',
                'aborted': '',
                'service-not-available': 'Speech recognition not available. Try Chrome or Edge.',
                'service-not-allowed': '',  // handled below with context
            };

            const errorMsg = errorMessages[event.error];

            // service-not-allowed: iOS fires this on first attempt before
            // permission is fully processed, and on restart attempts after
            // successful recognition. Auto-retry once, then show error.
            if (event.error === 'service-not-allowed') {
                if (hasSpokenRef.current) {
                    // Already captured speech — silently stop, don't scare user
                    stopListening();
                    clearSilenceTimer();
                    return;
                }
                // First attempt on iOS: permission may not be ready yet.
                // Auto-retry once after a short delay.
                if (!isStartingRef.current) {
                    isStartingRef.current = true;
                    setTimeout(() => {
                        try {
                            recognition.start();
                        } catch {
                            isStartingRef.current = false;
                            setError('Speech recognition not available. Try using Chrome or Safari.');
                            stopListening();
                            clearSilenceTimer();
                        }
                    }, 300);
                    return;
                }
                setError('Speech recognition service not allowed. Check browser settings.');
                stopListening();
                clearSilenceTimer();
                return;
            }

            if (errorMsg === '') {
                if (event.error === 'network') {
                    networkErrorCount++;
                    if (networkErrorCount >= 2) {
                        const isBrave = 'brave' in navigator;
                        setError(
                            isBrave
                                ? 'Brave Shield may block voice recognition. Please disable Shields for this site.'
                                : 'Ad blocker may block voice recognition. Please disable it for this site.'
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

    // ─── Whisper Provider (Raw PCM capture + transcription) ───

    const startWhisper = useCallback(async () => {
        setError('');

        // Pre-load model if not ready
        if (whisperStatus !== 'ready') {
            try {
                setInterim('Loading Whisper model (~40MB, one-time download)...');
                await loadWhisperModel();
                setInterim('');
            } catch {
                setError('Failed to load Whisper model. Check your internet connection.');
                return;
            }
        }

        try {
            await startAudioCapture();
            whisperRecordingRef.current = true;
            startListening();
            setInterim('Listening with Whisper... (tap mic to stop and transcribe)');
        } catch (err) {
            setError(`Microphone error: ${err instanceof Error ? err.message : err}`);
        }
    }, [whisperStatus, startListening, setError, setInterim]);

    const stopWhisper = useCallback(async () => {
        if (!whisperRecordingRef.current) return;
        whisperRecordingRef.current = false;

        try {
            setInterim('Transcribing with Whisper...');
            const audioData = await stopAudioCapture();

            // Check if we got enough audio (at least 0.5 seconds)
            if (audioData.length < 8000) {
                setInterim('');
                setError('Recording too short. Try speaking for at least 1 second.');
                stopListening();
                return;
            }

            const text = await transcribeAudio(audioData);
            if (text && text.trim()) {
                appendTranscript(text.trim());
                setInterim('');
            } else {
                setInterim('');
                setError('Could not understand audio. Try speaking louder and longer.');
            }
        } catch (err) {
            console.error('[Whisper] Stop/transcribe error:', err);
            setError('Failed to transcribe audio with Whisper.');
            setInterim('');
        }

        stopListening();
    }, [appendTranscript, setInterim, setError, stopListening]);

    // ─── Unified Start/Stop/Toggle ───

    const start = useCallback(async () => {
        const { sttProvider } = useVoiceSettingsStore.getState();

        if (sttProvider === 'whisper') {
            if (isMobile) {
                // Whisper WASM crashes mobile Safari — fall back to Web Speech
                setError('Whisper is too heavy for mobile. Switching to Web Speech.');
                useVoiceSettingsStore.getState().setSttProvider('webspeech');
                // Continue to Web Speech flow below
            } else {
                startWhisper();
                return;
            }
        }

        // Web Speech API flow
        if (!isSupported) {
            setError('Web Speech API is not supported in this browser. Try Chrome or Edge.');
            return;
        }

        // Request mic permission before starting (Issue #24)
        let micAllowed = false;
        try {
            micAllowed = await ensureMicPermission();
        } catch (err) {
            console.error('[VoiceInput] ensureMicPermission threw:', err);
            micAllowed = false;
        }

        if (!micAllowed) {
            // Platform-specific error messages
            const ua = navigator.userAgent || '';
            if (/iPhone|iPad|iPod/i.test(ua)) {
                setError('Microphone access denied. Go to Settings → Safari → Microphone, or Settings → [App Name] → Microphone to enable.');
            } else if (/Android/i.test(ua)) {
                setError('Microphone access denied. Go to Settings → Apps → Browser → Permissions → Microphone to enable.');
            } else {
                setError('Microphone permission denied. Please allow microphone access in your browser settings (click the lock icon in the address bar).');
            }
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
        resetTranscript(); // FIX-42: Clear old transcript before new session

        try {
            try { recognition.abort(); } catch { /* ignore */ }
            isStartingRef.current = true;
            recognition.start();
            startListening();
            resetSilenceTimer();
        } catch (err) {
            isStartingRef.current = false;
            if (err instanceof DOMException && err.name === 'InvalidStateError') {
                startListening();
            } else {
                setError(`Failed to start: ${err instanceof Error ? err.message : err}`);
            }
        }
    }, [isSupported, getRecognition, startListening, setError, resetSilenceTimer, startWhisper]);

    const stop = useCallback(() => {
        const { sttProvider } = useVoiceSettingsStore.getState();

        if (sttProvider === 'whisper') {
            stopWhisper();
            return;
        }

        // Web Speech API flow
        isStartingRef.current = false;
        currentInterim = '';
        hasSpokenRef.current = false;
        clearSilenceTimer();
        const recognition = recognitionRef.current;
        if (recognition) {
            try { recognition.stop(); } catch { /* ignore */ }
        }
        stopListening();
    }, [stopListening, clearSilenceTimer, stopWhisper]);

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
        whisperStatus,
        whisperProgress,
    };
}
