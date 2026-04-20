import { useEffect, useCallback, useRef } from 'react';
import { startRecording, stopAndTranscribe, stopRecording } from '@/lib/services/stt-service';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';
import { useVoiceStore } from '@/stores/voiceStore';

/**
 * Build a platform-specific error message for a denied / failed mic
 * permission. Used on the start() catch path so we don't have to do an
 * upfront `ensureMicPermission()` check (which would consume the user
 * gesture and force users to tap mic twice on iOS — see git blame).
 */
function micPermissionMessage(err: unknown): string {
  const name =
    err instanceof Error || (typeof err === 'object' && err && 'name' in err)
      ? String((err as { name?: string }).name || '')
      : '';
  const msg = err instanceof Error ? err.message : String(err);

  const isPermissionError =
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    name === 'SecurityError' ||
    /denied|permission/i.test(msg);

  if (!isPermissionError) {
    return `Microphone failed: ${msg}. Try again.`;
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return 'Microphone access denied. Go to Settings → Safari → Microphone (or the app permissions in iOS Settings) to enable.';
  }
  if (/Android/i.test(ua)) {
    return 'Microphone access denied. Open your device Settings → Apps → Guided Growth → Permissions → Microphone.';
  }
  return 'Microphone permission denied. Click the lock icon in the address bar to enable.';
}

export function useVoiceInput() {
  const {
    isListening,
    isPreparing,
    transcript,
    interim,
    error,
    isSupported,
    startPreparing,
    startListening,
    stopListening,
    appendTranscript,
    setInterim,
    setError,
    resetTranscript,
  } = useVoiceStore();

  const isStoppingRef = useRef(false);

  const start = useCallback(async () => {
    if (!useVoiceSettingsStore.getState().micEnabled) return;
    // Reset stuck state from previous failed session
    isStoppingRef.current = false;

    // CRITICAL: do NOT call ensureMicPermission() here. It calls
    // getUserMedia just to probe permission, then immediately stops the
    // tracks. On iOS Safari/WKWebView, that consumes the user gesture
    // context — and then the SECOND getUserMedia call inside
    // startRecording has no gesture and silently fails, so the user has
    // to tap the mic AGAIN to actually start recording. This is the
    // "double press" UX bug Yair flagged in the 2026-04-08 review meeting.
    // We let startRecording do the single getUserMedia call directly and
    // surface a platform-specific error from the catch block below.
    setError('');
    resetTranscript();
    // Enter "preparing" state immediately so the UI can show a spinner /
    // disabled mic button. The actual `isListening` state is set inside
    // the service `onOpen` callback below — that fires only after
    // getUserMedia, AudioContext, and the AudioWorklet are all wired up
    // (200–500ms on Android). Setting `isListening` early (the previous
    // behavior) caused users to start speaking before the recording was
    // live, eating the first ~300ms of audio and tripping "Recording too
    // short" on short utterances like "weekday" or "next".
    startPreparing();
    setInterim('Preparing mic...');

    try {
      await startRecording({
        onError: (err) => {
          console.error('[VoiceInput] STT recording error:', err);
          setError(err);
          stopListening();
          isStoppingRef.current = false;
        },
        onOpen: () => {
          // Recording is now live — getUserMedia returned, AudioContext is
          // running, and the worklet/script-processor is connected and
          // pushing chunks into audioChunks. Safe to tell the user "go".
          setInterim('Listening... (tap mic to stop and transcribe)');
          startListening();
        },
      });
    } catch (err) {
      console.warn('[VoiceInput] STT recording failed:', err);
      stopListening();
      stopRecording();
      isStoppingRef.current = false;
      setError(micPermissionMessage(err));
    }
  }, [startPreparing, startListening, stopListening, setError, resetTranscript, setInterim]);

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
        console.error('[VoiceInput] Transcription error:', err);
        setInterim('');
        resetTranscript();
        const msg = err instanceof Error ? err.message : 'Transcription failed.';
        // Make API errors user-friendly
        if (msg.includes('401') || msg.includes('Authentication') || msg.includes('Unauthorized')) {
          setError('Voice service needs login. Please sign in again.');
        } else if (
          msg.includes("didn't catch that") ||
          msg.includes('too short') ||
          msg.includes('Recording too short')
        ) {
          // Yair feedback 2026-04-09: never surface the raw "too short"
          // error. The service now throws the friendly prompt directly,
          // but keep the legacy string checks as a safety net.
          setError("I didn't catch that — could you say it again?");
        } else {
          setError(msg);
        }
      })
      .finally(() => {
        isStoppingRef.current = false;
      });
  }, [stopListening, appendTranscript, setInterim, setError, resetTranscript]);

  const toggle = useCallback(() => {
    // Block taps during the preparing window — getUserMedia/AudioContext
    // setup is in progress and a second start() would be a no-op
    // (startRecording has an isActive guard) but the UI flicker would
    // confuse users. Wait until we're either listening or back to idle.
    if (isPreparing) return;
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, isPreparing, start, stop]);

  // Cleanup on unmount ONLY — empty deps so the cleanup fires exactly
  // once when the component unmounts. Previously had `[stopListening]`
  // in the deps array, which meant any time that ref changed (React
  // StrictMode, parent re-render that perturbed store selectors) the
  // cleanup re-fired and killed the in-flight recording — sometimes
  // racing stopAndTranscribe's 120ms flush window and wiping
  // audioChunks before the transcription could read them.
  useEffect(() => {
    return () => {
      try {
        stopRecording();
      } catch {
        /* ignore */
      }
      // Read the live function from the store to avoid a stale closure.
      useVoiceStore.getState().stopListening();
    };
  }, []);

  return {
    isListening,
    isPreparing,
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
