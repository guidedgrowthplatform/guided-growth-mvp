import { useEffect, useCallback, useRef } from 'react';
import {
  startElevenLabs,
  stopAndTranscribe,
  stopElevenLabs,
} from '@/lib/services/elevenlabs-service';
import { ensureMicPermission } from '@/lib/services/mic-permissions';
import { useVoiceStore } from '@/stores/voiceStore';

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

  const isStoppingRef = useRef(false);

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
        setError(
          'Microphone access denied. Go to Settings → Apps → Browser → Permissions → Microphone.',
        );
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
      });
    } catch (err) {
      console.warn('[VoiceInput] ElevenLabs failed:', err);
      stopListening();
      stopElevenLabs();
      setError(`Microphone failed: ${err instanceof Error ? err.message : err}. Try again.`);
    }
  }, [startListening, stopListening, setError, resetTranscript, setInterim]);

  const stop = useCallback(() => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    stopListening(); // Immediately reflect "not recording" in UI
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
      .finally(() => {
        isStoppingRef.current = false;
      });
  }, [stopListening, appendTranscript, setInterim, setError, resetTranscript]);

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
      try {
        stopElevenLabs();
      } catch {
        /* ignore */
      }
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
