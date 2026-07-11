import { useEffect, useMemo, useState } from 'react';
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

// Duration rail (gate-1 decision #2, "dynamic rail"). Guided tracks fold up
// into the smallest standard step that fits (90s urge-surf lands in the 2-min
// bucket); soundscapes are the Sleep bucket. The rail renders ONLY the buckets
// that actually have a track, so it grows on its own when 3-min / 10-min tracks
// land -- no empty chips, no rework when the catalog fills.
const GUIDED_STEPS = [
  { key: '1', seconds: 60, label: '1 min' },
  { key: '2', seconds: 120, label: '2 min' },
  { key: '3', seconds: 180, label: '3 min' },
  { key: '5', seconds: 300, label: '5 min' },
  { key: '10', seconds: 600, label: '10 min' },
] as const;

const SLEEP_KEY = 'sleep';
const ALL_KEY = 'all';

function bucketKeyFor(t: ResetTrack): string {
  if (t.kind === 'soundscape') return SLEEP_KEY;
  const step = GUIDED_STEPS.find((s) => t.durationSec <= s.seconds);
  return (step ?? GUIDED_STEPS[GUIDED_STEPS.length - 1]).key;
}

function bucketLabel(key: string): string {
  if (key === SLEEP_KEY) return 'Sleep';
  const step = GUIDED_STEPS.find((s) => s.key === key);
  return step ? step.label : key;
}

export function ResetLibraryPage() {
  const navigate = useNavigate();
  const [activeBucket, setActiveBucket] = useState<string>(ALL_KEY);

  useEffect(() => {
    track('view_reset_library');
  }, []);

  // Buckets present in the catalog, in rail order (guided steps ascending, then
  // Sleep). Derived from the data so the rail is always in sync with what ships.
  const railBuckets = useMemo(() => {
    const present = new Set(visibleTracks.map(bucketKeyFor));
    const ordered: string[] = GUIDED_STEPS.map((s) => s.key).filter((k) => present.has(k));
    if (present.has(SLEEP_KEY)) ordered.push(SLEEP_KEY);
    return ordered;
  }, []);

  const shownTracks = useMemo(() => {
    const list =
      activeBucket === ALL_KEY
        ? visibleTracks
        : visibleTracks.filter((t) => bucketKeyFor(t) === activeBucket);
    // Guided ascending by length, soundscapes after, so the list reads short to long.
    return [...list].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'guided' ? -1 : 1;
      return a.durationSec - b.durationSec;
    });
  }, [activeBucket]);

  const handleOpenTrack = (resetTrack: ResetTrack) => {
    track('tap_reset_track', { track_id: resetTrack.id });
    navigate(`/reset/${resetTrack.id}`);
  };

  const handlePickBucket = (key: string) => {
    setActiveBucket(key);
    track('filter_reset_library', { bucket: key });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <div className="px-6 pt-[max(2rem,env(safe-area-inset-top))]">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">The Return</p>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight text-content">
          Come back to baseline
        </h1>
        <p className="mt-2 text-sm text-content-secondary">
          Recorded these for you. Pick how long you have.
        </p>
      </div>

      {/* Dynamic duration rail -- only buckets that have a track show up. */}
      <div className="mt-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[ALL_KEY, ...railBuckets].map((key) => {
          const active = key === activeBucket;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handlePickBucket(key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                active
                  ? 'bg-primary text-white'
                  : 'border border-border-light bg-surface text-content-secondary'
              }`}
            >
              {key === ALL_KEY ? 'All' : bucketLabel(key)}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col gap-2.5 px-6">
        {shownTracks.map((t) => (
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
    </div>
  );
}
