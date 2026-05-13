import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/analytics';
import type { ReleaseToken, Surface } from '@/contexts/voiceContextDef';
import manifestData from '@/data/voice-manifest.json';
import { useVoice } from '@/hooks/useVoice';
import { attemptPlayWithGestureFallback } from '@/lib/audio/attempt-play-with-gesture-fallback';
import { voiceAssetUrl } from '@/lib/config/voice';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

function deriveSurface(screen: string): Surface {
  if (screen.startsWith('WELCOME')) return 'splash';
  if (screen.startsWith('PREF')) return 'pref';
  if (screen.startsWith('MIC')) return 'mic_permission';
  if (screen.startsWith('POST-AUTH')) return 'post_auth';
  if (screen.startsWith('ONBOARD')) return 'onboarding';
  if (screen.startsWith('MCHECK')) return 'morning';
  if (screen.startsWith('ECHECK')) return 'evening';
  if (screen.startsWith('HABIT')) return 'habit_create';
  return 'chat';
}

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

interface PlayOptions {
  /** Retry play() on next gesture when blocked by iOS autoplay policy. */
  deferOnAutoplayBlock?: boolean;
}

interface UseVoicePlayerReturn {
  /** Play a pre-recorded MP3 by file_id from the manifest */
  play: (fileId: string, opts?: PlayOptions) => Promise<void>;
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
  const { acquireBroadcast, releaseToken, setBroadcastState } = useVoice();
  const [state, setState] = useState<VoicePlayerState>('idle');
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tokenRef = useRef<ReleaseToken | null>(null);
  const mountedRef = useRef(true);

  const dropToken = useCallback(() => {
    const t = tokenRef.current;
    if (!t) return;
    tokenRef.current = null;
    releaseToken(t);
  }, [releaseToken]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      dropToken();
    };
  }, [dropToken]);

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
    dropToken();
  }, [dropToken]);

  const play = useCallback(
    async (fileId: string, opts?: PlayOptions): Promise<void> => {
      if (!useVoiceSettingsStore.getState().ttsEnabled) return;

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

      // Stop any existing playback (and release the prior token).
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      dropToken();

      const token = acquireBroadcast({
        surface: deriveSurface(entry.screen),
        assetId: fileId,
        onCleanup: () => {
          tokenRef.current = null;
          const a = audioRef.current;
          if (a) {
            a.pause();
            a.currentTime = 0;
            audioRef.current = null;
          }
          if (mountedRef.current) {
            setState('idle');
            setCurrentFileId(null);
          }
        },
      });
      if (!token) return;
      tokenRef.current = token;

      setState('loading');
      setCurrentFileId(fileId);

      try {
        const audio = new Audio(src);
        audioRef.current = audio;

        await new Promise<void>((resolve, reject) => {
          audio.oncanplaythrough = () => {
            if (mountedRef.current) setState('playing');
            const t = tokenRef.current;
            if (t) setBroadcastState(t, 'playing');
          };
          audio.onended = () => {
            audioRef.current = null;
            if (mountedRef.current) {
              setState('idle');
              setCurrentFileId(null);
            }
            dropToken();
            resolve();
          };
          audio.onerror = () => {
            audioRef.current = null;
            if (mountedRef.current) {
              setState('error');
              setCurrentFileId(null);
            }
            dropToken();
            reject(new Error(`Failed to load audio: ${fileId}`));
          };
          attemptPlayWithGestureFallback(audio, { defer: opts?.deferOnAutoplayBlock })
            .then(() => {
              track('play_mp3', {
                file_id: fileId,
                screen: entry.screen,
                trigger: entry.trigger,
              });
            })
            .catch((err) => {
              if (mountedRef.current) setState('error');
              dropToken();
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
    [acquireBroadcast, dropToken, setBroadcastState],
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
