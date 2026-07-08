import { Icon } from '@iconify/react';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { CARD, FONT, INK, PRIMARY, SPACE, SUBTLE } from './_beatStyle';

type ResetStage = 'browse' | 'player' | 'nudges';

const tracks = [
  { title: '60s reset', bucket: '1 min', kind: 'guided' },
  { title: 'Settle', bucket: '2 min', kind: 'guided' },
  { title: '2min reset', bucket: '2 min', kind: 'guided' },
  { title: 'Urge surf', bucket: '2 min', kind: 'guided' },
  { title: '5min reset', bucket: '5 min', kind: 'guided' },
  { title: 'Ten minute bed', bucket: '10 min', kind: 'soundscape' },
];

function Chip({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '7px 11px',
        border: `1px solid ${active ? PRIMARY : 'rgba(15,23,42,0.08)'}`,
        background: active ? 'rgba(19,91,236,0.09)' : '#fff',
        color: active ? PRIMARY : INK,
        fontFamily: FONT,
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {label}
    </span>
  );
}

function TrackCard({ title, bucket, kind }: { title: string; bucket: string; kind: string }) {
  return (
    <div
      style={{
        ...CARD,
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.md,
        padding: `${SPACE.md}px`,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 16,
          background: kind === 'soundscape' ? 'rgba(100,74,185,0.10)' : 'rgba(19,91,236,0.09)',
          color: kind === 'soundscape' ? 'rgb(100,74,185)' : PRIMARY,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon icon={kind === 'soundscape' ? 'mdi:waves' : 'mdi:waveform'} width={22} height={22} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 850, color: INK }}>{title}</div>
        <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: SUBTLE }}>
          {bucket} · {kind}
        </div>
      </div>
      <Icon icon="mdi:play-circle" width={28} height={28} style={{ color: PRIMARY, flexShrink: 0 }} />
    </div>
  );
}

function Browse() {
  const buckets = ['1 min', '2 min', '5 min', '10 min', 'Sleep'];
  return (
    <div style={{ display: 'flex', width: '100%', flexDirection: 'column', gap: SPACE.lg }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 800, color: PRIMARY }}>Reset</div>
        <h2 style={{ margin: 0, fontFamily: FONT, fontSize: 28, lineHeight: 1.05, fontWeight: 900, color: INK }}>
          The Return
        </h2>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {buckets.map((bucket, i) => (
          <Chip key={bucket} label={bucket} active={i === 1} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        {tracks.map((track) => (
          <TrackCard key={`${track.title}-${track.bucket}`} {...track} />
        ))}
      </div>
    </div>
  );
}

function Player() {
  return (
    <div
      style={{
        minHeight: 620,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACE.xl,
        padding: `${SPACE.xl}px ${SPACE.lg}px`,
      }}
    >
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Icon icon="mdi:chevron-left" width={28} height={28} style={{ color: INK }} />
        <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 800, color: SUBTLE }}>2 min · guided</span>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontFamily: FONT, fontSize: 30, fontWeight: 900, color: INK }}>Settle</h2>
        <p style={{ margin: '6px 0 0', fontFamily: FONT, fontSize: 13, fontWeight: 700, color: SUBTLE }}>
          whatFor copy pending
        </p>
      </div>
      <div
        style={{
          width: 210,
          height: 210,
          borderRadius: 999,
          background: 'radial-gradient(circle, rgba(19,91,236,0.22), rgba(19,91,236,0.06) 62%, rgba(19,91,236,0) 72%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: 132, height: 132, borderRadius: 999, background: 'rgba(255,255,255,0.92)' }} />
      </div>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        <div style={{ height: 6, borderRadius: 999, background: 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
          <div style={{ width: '36%', height: '100%', borderRadius: 999, background: PRIMARY }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE.xl }}>
          <Icon icon="mdi:rewind-15" width={30} height={30} style={{ color: SUBTLE }} />
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 999,
              background: PRIMARY,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 16px 34px -18px rgba(19,91,236,0.9)',
            }}
          >
            <Icon icon="mdi:play" width={38} height={38} />
          </div>
          <Icon icon="mdi:fast-forward-15" width={30} height={30} style={{ color: SUBTLE }} />
        </div>
      </div>
    </div>
  );
}

function Nudges() {
  return (
    <div style={{ display: 'flex', width: '100%', flexDirection: 'column', gap: SPACE.lg }}>
      <div>
        <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 800, color: PRIMARY }}>Reset reminders</div>
        <h2 style={{ margin: '4px 0 0', fontFamily: FONT, fontSize: 24, fontWeight: 900, color: INK }}>
          Nudge slots
        </h2>
      </div>
      {[1, 2].map((slot) => (
        <div key={slot} style={{ ...CARD, padding: SPACE.md, display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 850, color: INK }}>Reset nudge {slot}</span>
            <Chip label={slot === 1 ? 'On' : 'Off'} active={slot === 1} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip label={slot === 1 ? '3:00 PM' : 'Choose time'} />
            <Chip label={slot === 1 ? 'Settle' : 'Choose track'} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ResetLibraryBeat(props?: Record<string, string>) {
  const stage = (props?.stage as ResetStage | undefined) ?? 'browse';
  const node = stage === 'player' ? <Player /> : stage === 'nudges' ? <Nudges /> : <Browse />;
  const steps: BeatStep[] = [{ id: stage, speaker: 'coach', render: node }];
  return <BeatPlayer steps={steps} />;
}

const resetLibraryBeat: BeatDef = {
  type: 'reset-library',
  group: 'Library',
  label: 'Reset library',
  Comp: ResetLibraryBeat,
};

export default resetLibraryBeat;
