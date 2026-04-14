import { useCallback, useEffect, useRef, useState } from 'react';
import manifestData from '@/data/voice-manifest.json';
import { useVoice } from '@/hooks/useVoice';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ManifestEntry {
  url: string;
  hash: string;
  screen: string;
  trigger: string;
  size_bytes: number;
  generated_at: string;
  text?: string; // Screen-mode display text (Phase 1+)
}

type ManifestFiles = Record<string, ManifestEntry>;

export type VoicePlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface UseVoicePlayerReturn {
  /** Play a pre-recorded MP3 by file_id from the manifest */
  play: (fileId: string) => Promise<void>;
  /** Stop playback */
  stop: () => void;
  /** Pause playback */
  pause: () => void;
  /** Resume playback */
  resume: () => void;
  /** Current state */
  state: VoicePlayerState;
  /** Currently playing file ID */
  currentFileId: string | null;
}

// ─── Manifest Loader ────────────────────────────────────────────────────────

const manifest = (manifestData as { files: ManifestFiles }).files;

function getManifestEntry(fileId: string): ManifestEntry | null {
  return manifest[fileId] ?? null;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Hook for playing pre-recorded MP3 files from the voice manifest.
 *
 * Respects VoiceContext mutual exclusion — entering mp3 mode will stop
 * any active realtime session, and vice versa.
 *
 * Trigger patterns (from Voice Export tab):
 * - screen_load: useEffect on mount → play(fileId)
 * - button_tap: onClick → play(fileId)
 * - after_selection: in selection callback → play(fileId)
 * - after_delay: useEffect with setTimeout → play(fileId)
 * - on_complete: in completion callback → play(fileId)
 */
export function useVoicePlayer(): UseVoicePlayerReturn {
  const { enterMp3, release, registerCleanup, preference } = useVoice();
  const [state, setState] = useState<VoicePlayerState>('idle');
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);

  // Track mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Cleanup audio on unmount
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (mountedRef.current) {
      setState('idle');
      setCurrentFileId(null);
    }
    release();
  }, [release]);

  const play = useCallback(
    async (fileId: string): Promise<void> => {
      // Respect voice preference — text_only means no audio
      if (preference === 'text_only') return;

      // Skip if already playing this file (React double-render guard)
      if (currentFileId === fileId && state === 'playing') return;

      const entry = getManifestEntry(fileId);
      if (!entry) {
        console.warn(`[VoicePlayer] No manifest entry for file_id: ${fileId}`);
        return;
      }

      // Request mp3 mode (stops realtime if active)
      const ok = enterMp3();
      if (!ok) return;

      // Stop any existing playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setState('loading');
      setCurrentFileId(fileId);

      try {
        const audio = new Audio(entry.url);
        audioRef.current = audio;

        // Register cleanup so VoiceContext can stop us
        registerCleanup(() => {
          audio.pause();
          audio.currentTime = 0;
          audioRef.current = null;
          if (mountedRef.current) {
            setState('idle');
            setCurrentFileId(null);
          }
        });

        await new Promise<void>((resolve, reject) => {
          audio.oncanplaythrough = () => {
            if (mountedRef.current) setState('playing');
          };
          audio.onended = () => {
            audioRef.current = null;
            if (mountedRef.current) {
              setState('idle');
              setCurrentFileId(null);
            }
            release();
            resolve();
          };
          audio.onerror = () => {
            audioRef.current = null;
            if (mountedRef.current) {
              setState('error');
              setCurrentFileId(null);
            }
            release();
            reject(new Error(`Failed to load audio: ${fileId}`));
          };
          audio.play().catch((err) => {
            // Autoplay blocked — common on iOS
            if (mountedRef.current) setState('error');
            release();
            reject(err);
          });
        });
      } catch (err: unknown) {
        const error = err as Error;
        if (error?.name !== 'AbortError' && error?.name !== 'NotAllowedError') {
          console.warn(`[VoicePlayer] Error playing ${fileId}:`, err);
        }
        if (mountedRef.current) {
          setState('error');
          setCurrentFileId(null);
        }
      }
    },
    [enterMp3, release, registerCleanup, preference, currentFileId, state],
  );

  const pause = useCallback(() => {
    if (audioRef.current && state === 'playing') {
      audioRef.current.pause();
      setState('paused');
    }
  }, [state]);

  const resume = useCallback(() => {
    if (audioRef.current && state === 'paused') {
      audioRef.current.play().catch(() => {
        setState('error');
      });
      setState('playing');
    }
  }, [state]);

  return { play, stop, pause, resume, state, currentFileId };
}
