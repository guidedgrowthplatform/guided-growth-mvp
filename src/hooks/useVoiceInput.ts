import { useEffect, useCallback } from 'react';
import { useVoiceStore } from '@/stores/voiceStore';
import { startElevenLabs, stopAndTranscribe, stopElevenLabs } from '@/lib/services/elevenlabs-service';
import { ensureMicPermission } from '@/lib/services/mic-permissions';

/**
 * useVoiceInput — ElevenLabs-only voice input hook
 *
 * Flow: start() → mic capture → stop() → ElevenLabs Scribe v2 → transcript
 * Auto-execute is handled by useVoiceCommand (listens to transcript changes)
 */
export function useVoiceInput() {
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
    } = useVoiceStore();

    const start = useCallback(async () => {
        // Request mic permission first
        let micAllowed = false;
        try {
            micAllowed = await ensureMicPermission();
        } catch (err) {
            console.error('[VoiceInput] ensureMicPermission threw:', err);
        }

        if (!micAllowed) {
            const ua = navigator.userAgent || '';
            if (/iPhone|iPad|iPod/i.test(ua)) {
                setError('Microphone access denied. Go to Settings → Safari → Microphone to enable.');
            } else if (/Android/i.test(ua)) {
                setError('Microphone access denied. Go to Settings → Apps → Browser → Permissions → Microphone.');
            } else {
                setError('Microphone permission denied. Click the lock icon in the address bar to enable.');
            }
            return;
        }

        setError('');
        resetTranscript();
        setInterim('Listening... (tap mic to stop and transcribe)');
        startListening();

        try {
            await startElevenLabs({
                onError: (err) => {
                    setError(err);
                    stopListening();
                },
                onOpen: () => {},
                onClose: () => {},
            });
        } catch (err) {
            console.warn('[VoiceInput] ElevenLabs failed:', err);
            stopListening();
            stopElevenLabs();
            setError(`Microphone failed: ${err instanceof Error ? err.message : err}. Try again.`);
        }
    }, [startListening, stopListening, setError, resetTranscript, setInterim]);

    const stop = useCallback(() => {
        setInterim('Transcribing...');
        stopAndTranscribe()
            .then((text) => {
                if (text && text.trim()) {
                    appendTranscript(text.trim());
                    setInterim('');
                } else {
                    setInterim('');
                    setError('Could not understand audio. Try speaking louder and longer.');
                }
            })
            .catch((err) => {
                setInterim('');
                resetTranscript();
                setError(err instanceof Error ? err.message : 'Transcription failed.');
            })
            .finally(() => stopListening());
    }, [stopListening, appendTranscript, setInterim, setError]);

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
            try { stopElevenLabs(); } catch { /* ignore */ }
            stopListening();
        };
    }, [stopListening]);

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
