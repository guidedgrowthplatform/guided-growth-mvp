import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { ResetTrackRow } from '@/components/reset/ResetTrackRow';
import manifestData from '@/data/reset-manifest.json';

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
const allTracks = Object.values(manifest);

// Settle is recorded EN + HE (pairId links the two rows in the manifest) but
// shown once here -- the player screen carries the EN/HE switch. De-dupe by
// only keeping the first side of any pair (settle-en) in the rendered list.
const seenPairs = new Set<string>();
const visibleTracks = allTracks.filter((t) => {
  if (t.pairId && seenPairs.has(t.pairId)) return false;
  if (t.pairId) seenPairs.add(t.id);
  return true;
});

const shortTracks = visibleTracks
  .filter((t) => t.kind === 'guided')
  .sort((a, b) => a.durationSec - b.durationSec);
const sleepTracks = visibleTracks.filter((t) => t.kind === 'soundscape');

export function ResetLibraryPage() {
  const navigate = useNavigate();

  useEffect(() => {
    track('view_reset_library');
  }, []);

  const handleOpenTrack = (resetTrack: ResetTrack) => {
    track('tap_reset_track', { track_id: resetTrack.id });
    navigate(`/reset/${resetTrack.id}`);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <div className="px-6 pt-[max(2rem,env(safe-area-inset-top))]">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">The return</p>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight text-content">
          Come back to baseline
        </h1>
        <p className="mt-2 text-sm text-content-secondary">
          Recorded these for you. Pick how long you have.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-8 px-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
            Short
          </h2>
          <div className="flex flex-col gap-2.5">
            {shortTracks.map((t) => (
              <ResetTrackRow
                key={t.id}
                title={t.title}
                whatFor={t.whatFor}
                kind={t.kind}
                durationSec={t.durationSec}
                paired={Boolean(t.pairId)}
                onClick={() => handleOpenTrack(t)}
              />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
            Sleep
          </h2>
          <div className="flex flex-col gap-2.5">
            {sleepTracks.map((t) => (
              <ResetTrackRow
                key={t.id}
                title={t.title}
                whatFor={t.whatFor}
                kind={t.kind}
                durationSec={t.durationSec}
                onClick={() => handleOpenTrack(t)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
