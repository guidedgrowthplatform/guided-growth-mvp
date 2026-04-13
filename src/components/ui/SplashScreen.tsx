import { useCallback, useEffect, useRef } from 'react';
import { useVoicePlayer } from '@/hooks/useVoicePlayer';
import { LoadingSpinner } from './LoadingSpinner';

const SPLASH_VOICE_ID = 'splash_welcome';

export function SplashScreen() {
  const { play, stop, state, currentFileId } = useVoicePlayer();
  const hasPlayedRef = useRef(false);
  const playRef = useRef(play);
  const stopRef = useRef(stop);
  const currentFileIdRef = useRef(currentFileId);

  // Keep refs in sync without triggering re-renders
  useEffect(() => {
    playRef.current = play;
  }, [play]);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);
  useEffect(() => {
    currentFileIdRef.current = currentFileId;
  }, [currentFileId]);

  // Auto-play splash voice on mount, stop on unmount.
  // Note: React StrictMode double-mounts, so we reset hasPlayedRef on cleanup
  // to allow the second mount to actually play.
  useEffect(() => {
    if (hasPlayedRef.current) return;
    hasPlayedRef.current = true;

    // Small delay to let audio context initialize
    const timer = setTimeout(() => {
      playRef.current(SPLASH_VOICE_ID).catch(() => {
        // Autoplay blocked or MP3 not found — silent fallback
      });
    }, 300);

    return () => {
      clearTimeout(timer);
      hasPlayedRef.current = false; // Allow re-play on StrictMode re-mount
      if (currentFileIdRef.current === SPLASH_VOICE_ID) {
        stopRef.current();
      }
    };
  }, []); // empty deps — fire only on mount

  const handleTap = useCallback(() => {
    if (state === 'playing') {
      stop();
    }
  }, [state, stop]);

  const isPlaying = state === 'playing';

  return (
    <div
      className="flex h-screen flex-col items-center justify-center bg-surface-secondary"
      onClick={handleTap}
      aria-label={isPlaying ? 'Tap to stop voice introduction' : undefined}
      role={isPlaying ? 'button' : undefined}
      tabIndex={isPlaying ? 0 : undefined}
      onKeyDown={
        isPlaying
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') handleTap();
            }
          : undefined
      }
    >
      <h1 className="text-2xl font-bold text-primary">Guided Growth</h1>
      <LoadingSpinner size="sm" className="mt-4" />
      {isPlaying && (
        <p className="mt-3 animate-pulse text-sm text-gray-500">Tap anywhere to skip</p>
      )}
    </div>
  );
}
