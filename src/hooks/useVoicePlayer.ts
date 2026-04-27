import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/analytics';
import manifestData from '@/data/voice-manifest.json';
import { useVoice } from '@/hooks/useVoice';
import { voiceAssetUrl } from '@/lib/config/voice';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ManifestEntry {
  /**
   * Canonical filename of the asset in the Supabase voice-assets bucket
   * (e.g. "splash_hook.mp3"). The full URL is constructed at play time
   * via voiceAssetUrl() so VITE_SUPABASE_URL stays the single source of
   * truth for the project + bucket host (Alejandro review, MR !103).
   */
  file?: string;
  /** Legacy full URL. Kept for older manifest rows (sync-script era). */
  url?: string;
  screen: string;
  trigger: string;
  hash?: string;
  size_bytes?: number;
  generated_at?: string;
  duration_seconds?: number;
  text?: string;
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

      const entry = getManifestEntry(fileId);
      if (!entry) {
        // Onboarding pages (ONBOARD-02..09) still pass `voiceFileId` props
        // that point at the legacy sync-script manifest keys. The post-!103
        // manifest only carries the 7 canonical Phase 1 files (splash_hook,
        // pref_can_i_talk, mic_*, welcome_*); everything else lands here as
        // a no-op on purpose — those screens are agent-driven, not MP3.
        //
        // A production console.warn on every page nav floods the Vercel
        // runtime logs and scares reviewers (Alejandro flagged this in the
        // 2026-04-25 review). Gate to dev-only so we still catch genuine
        // typos while developing locally.
        if (import.meta.env.DEV) {
          console.warn(`[VoicePlayer] No manifest entry for file_id: ${fileId}`);
        }
        return;
      }

      // Resolve the asset URL. New manifest rows carry `file` (bucket
      // filename) and we prepend the env-derived base; older rows still
      // carry an absolute `url` for local `/voice/*.mp3` paths, which
      // stays a passthrough.
      const src = entry.file ? voiceAssetUrl(entry.file) : (entry.url ?? '');
      if (!src) {
        console.warn(`[VoicePlayer] Cannot resolve URL for file_id: ${fileId}`);
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
        const audio = new Audio(src);
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
          audio
            .play()
            .then(() => {
              // Fires only on successful playback start — autoplay
              // rejections go to the .catch below and emit no event.
              track('play_mp3', {
                file_id: fileId,
                screen: entry.screen,
                trigger: entry.trigger,
              });
            })
            .catch((err) => {
              // Autoplay blocked — common on iOS
              if (mountedRef.current) setState('error');
              release();
              reject(err);
            });
        });
      } catch (err) {
        // DOMException on autoplay is the common case (browser autoplay
        // policy kicks in before first user gesture). Spamming prod
        // console for each page nav is noise — same rationale as above.
        if (import.meta.env.DEV) {
          console.warn(`[VoicePlayer] Error playing ${fileId}:`, err);
        }
        if (mountedRef.current) {
          setState('error');
          setCurrentFileId(null);
        }
      }
    },
    [enterMp3, release, registerCleanup, preference],
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
        if (mountedRef.current) setState('error');
      });
      setState('playing');
    }
  }, [state]);

  return { play, stop, pause, resume, state, currentFileId };
}
