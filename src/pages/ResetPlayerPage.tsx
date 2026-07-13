import { Icon } from '@iconify/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { track } from '@/analytics';
import { BreathCircle } from '@/components/reset/BreathCircle';
import manifestData from '@/data/reset-manifest.json';
import { useVoicePlayer } from '@/hooks/useVoicePlayer';

interface ResetTrack {
  id: string;
  title: string;
  durationSec: number;
  language: string;
  kind: 'guided' | 'soundscape';
  whatFor: string;
  file: string;
  pairId?: string;
}

const manifest = (manifestData as { files: Record<string, ResetTrack> }).files;

const SKIP_SECONDS = 15;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ResetPlayerPage() {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const voicePlayer = useVoicePlayer();

  const currentTrack = trackId ? (manifest[trackId] ?? null) : null;

  // Mock playback clock. Real audio isn't recorded yet (voicePlayer.play()
  // below no-ops gracefully since these ids aren't in voice-manifest.json
  // yet) -- this local tick is what actually drives the UI for the mock.
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    track('view_reset_player', { track_id: trackId ?? 'unknown' });
  }, [trackId]);

  // Reset local playback state whenever the track changes (e.g. EN/HE switch).
  useEffect(() => {
    setIsPlaying(false);
    setElapsedSec(0);
    clearTick();
    voicePlayer.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  useEffect(() => clearTick, [clearTick]);

  const startTick = useCallback(
    (durationSec: number) => {
      clearTick();
      intervalRef.current = setInterval(() => {
        setElapsedSec((prev) => {
          const next = prev + 1;
          if (next >= durationSec) {
            clearTick();
            setIsPlaying(false);
            return durationSec;
          }
          return next;
        });
      }, 1000);
    },
    [clearTick],
  );

  const handlePlayPause = () => {
    if (!currentTrack) return;
    if (isPlaying) {
      clearTick();
      setIsPlaying(false);
      voicePlayer.pause();
      return;
    }
    // Fire-and-forget: no manifest entry exists yet under this id in
    // voice-manifest.json, so this resolves to a no-op (dev console warning
    // only) rather than real playback -- exactly the "graceful 404" called
    // for in a mock with no recorded audio.
    void voicePlayer.play(currentTrack.id);
    if (elapsedSec >= currentTrack.durationSec) setElapsedSec(0);
    setIsPlaying(true);
    startTick(currentTrack.durationSec);
  };

  const handleSkip = (deltaSec: number) => {
    if (!currentTrack) return;
    setElapsedSec((prev) => Math.min(currentTrack.durationSec, Math.max(0, prev + deltaSec)));
  };

  const handleSeek = (value: number) => {
    if (!currentTrack) return;
    setElapsedSec(Math.min(currentTrack.durationSec, Math.max(0, value)));
  };

  const handleClose = () => {
    clearTick();
    voicePlayer.stop();
    navigate('/reset');
  };

  const handleLanguageSwitch = (nextId: string) => {
    if (!nextId || nextId === trackId) return;
    navigate(`/reset/${nextId}`, { replace: true });
  };

  if (!currentTrack) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-primary-bg px-6 text-center">
        <p className="text-base font-semibold text-content">Track not found</p>
        <button
          type="button"
          onClick={() => navigate('/reset')}
          className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white"
        >
          Back to Reset
        </button>
      </div>
    );
  }

  const progress = currentTrack.durationSec > 0 ? elapsedSec / currentTrack.durationSec : 0;

  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between px-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        {currentTrack.pairId ? (
          <div className="flex items-center gap-1 rounded-full bg-surface-secondary p-1">
            <button
              type="button"
              onClick={() =>
                handleLanguageSwitch(
                  currentTrack.language === 'EN' ? trackId! : currentTrack.pairId!,
                )
              }
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                currentTrack.language === 'EN'
                  ? 'bg-surface text-content shadow-sm'
                  : 'text-content-tertiary'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() =>
                handleLanguageSwitch(
                  currentTrack.language === 'HE' ? trackId! : currentTrack.pairId!,
                )
              }
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                currentTrack.language === 'HE'
                  ? 'bg-surface text-content shadow-sm'
                  : 'text-content-tertiary'
              }`}
            >
              HE
            </button>
          </div>
        ) : (
          <div />
        )}

        <button
          type="button"
          aria-label="Close"
          onClick={handleClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary text-content"
        >
          <Icon icon="mingcute:close-line" width={20} />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <BreathCircle active={isPlaying} />

        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-semibold text-content">{currentTrack.title}</h1>
          <p className="text-sm text-content-secondary">
            {formatTime(currentTrack.durationSec)} · {currentTrack.language}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-8 px-6 pb-8">
        <div className="flex flex-col gap-2">
          <input
            type="range"
            aria-label="Seek"
            min={0}
            max={currentTrack.durationSec}
            step={1}
            value={elapsedSec}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="h-1.5 w-full appearance-none rounded-full bg-border accent-primary"
            style={{
              background: `linear-gradient(to right, rgb(var(--color-primary)) ${progress * 100}%, rgb(var(--color-border)) ${progress * 100}%)`,
            }}
          />
          <div className="flex justify-between text-xs text-content-tertiary">
            <span>{formatTime(elapsedSec)}</span>
            <span>{formatTime(currentTrack.durationSec)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-8">
          <button
            type="button"
            aria-label="Back 15 seconds"
            onClick={() => handleSkip(-SKIP_SECONDS)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-border"
          >
            <Icon icon="mingcute:rewind-backward-15-fill" width={24} className="text-content" />
          </button>

          <button
            type="button"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={handlePlayPause}
            className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark shadow-[0px_20px_25px_-5px_rgba(191,219,254,0.5)]"
          >
            <Icon
              icon={isPlaying ? 'mingcute:pause-fill' : 'mingcute:play-fill'}
              width={40}
              className="text-white"
            />
          </button>

          <button
            type="button"
            aria-label="Forward 15 seconds"
            onClick={() => handleSkip(SKIP_SECONDS)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-border"
          >
            <Icon icon="mingcute:rewind-forward-15-fill" width={24} className="text-content" />
          </button>
        </div>
      </div>
    </div>
  );
}
