import { useEffect, useRef } from 'react';

export function useAutoplayVoice(src: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audioRef.current = audio;

    let gestureHandler: (() => void) | null = null;

    const attempt = audio.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {
        gestureHandler = () => {
          audio.play().catch(() => {});
          cleanupGesture();
        };
        document.addEventListener('pointerdown', gestureHandler, { once: true });
        document.addEventListener('touchstart', gestureHandler, { once: true });
      });
    }

    function cleanupGesture() {
      if (!gestureHandler) return;
      document.removeEventListener('pointerdown', gestureHandler);
      document.removeEventListener('touchstart', gestureHandler);
      gestureHandler = null;
    }

    return () => {
      cleanupGesture();
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [src]);

  return audioRef;
}
