import { Icon } from '@iconify/react';
import { useState } from 'react';
import { ResetTrackRow } from '@/components/reset/ResetTrackRow';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { TimePicker } from '@/components/ui/TimePicker';
import { Toggle } from '@/components/ui/Toggle';
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

// One row per track in the picker -- Settle shows once (the player carries EN/HE).
const seenPairs = new Set<string>();
const pickableTracks = allTracks.filter((t) => {
  if (t.pairId && seenPairs.has(t.pairId)) return false;
  if (t.pairId) seenPairs.add(t.id);
  return true;
});

interface NudgeSlot {
  enabled: boolean;
  time: string;
  trackId: string;
}

// Notification copy PREVIEW. In production this is authored as Sheet rows (never
// a hardcoded string, never a voice line, never directs a tap) -- gate-1 grounding.
// The title is neutral product copy; the body reuses the track's own whatFor line.
function nudgeCopy(track: ResetTrack): { title: string; body: string } {
  return { title: 'A moment to reset', body: track.whatFor };
}

interface NudgeCardProps {
  index: number;
  slot: NudgeSlot;
  track: ResetTrack;
  onToggle: (v: boolean) => void;
  onTimeChange: (time24: string) => void;
  onPickTrack: () => void;
}

function NudgeCard({ index, slot, track, onToggle, onTimeChange, onPickTrack }: NudgeCardProps) {
  const copy = nudgeCopy(track);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-surface p-[17px] shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-bg">
            <Icon icon="ph:waves-bold" width={22} className="text-primary" />
          </div>
          <span className="text-base font-bold text-content">Reset nudge {index + 1}</span>
        </div>
        <Toggle
          checked={slot.enabled}
          onChange={onToggle}
          ariaLabel={`Enable reset nudge ${index + 1}`}
        />
      </div>

      {slot.enabled && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between py-1">
            <span className="text-sm font-semibold uppercase tracking-wide text-content-tertiary">
              Time
            </span>
            <TimePicker value={slot.time} onChange={onTimeChange} />
          </div>

          <button
            type="button"
            onClick={onPickTrack}
            className="flex items-center justify-between py-2 text-left"
          >
            <span className="text-sm font-semibold uppercase tracking-wide text-content-tertiary">
              Reset
            </span>
            <span className="flex items-center gap-1 text-sm font-bold text-content">
              {track.title}
              <Icon icon="ic:round-chevron-right" width={18} className="text-content-tertiary" />
            </span>
          </button>

          {/* How the notification reads when it fires. */}
          <div className="mt-1 rounded-xl bg-primary-bg p-3">
            <p className="text-xs font-bold text-content">{copy.title}</p>
            <p className="mt-0.5 text-xs text-content-secondary">{copy.body}</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface ResetNudgeSheetProps {
  onClose: () => void;
}

/**
 * Reset-nudge config (gate-1 grounding, "what you design here"). Two nudge
 * slots, each an enabled toggle + a time + a track (picked from a browse-lite
 * bottom sheet). Reuses the app's real Toggle / TimePicker / BottomSheet so it
 * matches the existing reminder sheet, and its own titled section keeps it apart
 * from the check-in reminders (grounding decision #7).
 */
export function ResetNudgeSheet({ onClose }: ResetNudgeSheetProps) {
  const [slots, setSlots] = useState<NudgeSlot[]>([
    { enabled: true, time: '08:00', trackId: 'drop-in' },
    { enabled: false, time: '21:30', trackId: 'settle-en' },
  ]);
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  const update = (i: number, patch: Partial<NudgeSlot>) =>
    setSlots((prev) => prev.map((slot, idx) => (idx === i ? { ...slot, ...patch } : slot)));

  return (
    <>
      <BottomSheet onClose={onClose}>
        {(close) => (
          <div
            className="flex flex-col gap-6 px-6 pt-2"
            style={{ paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}
          >
            <div>
              <h2 className="text-2xl font-semibold leading-tight text-content">Reset nudges</h2>
              <p className="mt-2 text-base font-medium text-content-secondary">
                A gentle ping at a time you choose, opening straight to a reset.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {slots.map((slot, i) => (
                <NudgeCard
                  key={i}
                  index={i}
                  slot={slot}
                  track={manifest[slot.trackId]}
                  onToggle={(v) => update(i, { enabled: v })}
                  onTimeChange={(t) => update(i, { time: t })}
                  onPickTrack={() => setPickerFor(i)}
                />
              ))}
            </div>

            {/* Honest about being a phone feature (grounding constraint). */}
            <p className="text-xs text-content-tertiary">
              Scheduled on your phone. On the web, delivery follows the browser&apos;s reminder
              limits.
            </p>

            <button
              type="button"
              onClick={close}
              className="w-full rounded-full bg-primary py-4 text-lg font-bold text-white transition-colors hover:bg-primary-dark"
            >
              Save nudges
            </button>
          </div>
        )}
      </BottomSheet>

      {pickerFor !== null && (
        <BottomSheet onClose={() => setPickerFor(null)}>
          {(close) => (
            <div className="flex flex-col gap-3 px-6 pb-8 pt-2">
              <h3 className="text-lg font-bold text-content">Pick a reset</h3>
              <div className="flex flex-col gap-2.5">
                {pickableTracks.map((t) => (
                  <ResetTrackRow
                    key={t.id}
                    title={t.title}
                    whatFor={t.whatFor}
                    kind={t.kind}
                    durationSec={t.durationSec}
                    paired={Boolean(t.pairId)}
                    onClick={() => {
                      update(pickerFor, { trackId: t.id });
                      close();
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </BottomSheet>
      )}
    </>
  );
}
