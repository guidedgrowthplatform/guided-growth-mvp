import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '@iconify/react';
import { COACH_BG } from './beats/_beatStyle';
import { SpokenWordsCtx } from './beatKit';
import { Orb } from '@/components/orb/Orb';
import { orbIdle, orbSpeaking } from '@/components/orb/orbView';
import { runBeatScript, stopSpeech } from './beatNarration';
import { BEATS, IsolatedBeat, METADATA_BY_SCREEN_ID, TABS } from './FlowDesigner';

// Play mode: runs the real onboarding beats in order in a single phone, speaking
// each opener and per-element line with the browser voice (a stand-in for the
// recorded MP3), and driving the real components' reveal off that voice. Same
// components and same wording (from the metadata) as the annotated view, just
// played instead of stacked. The reveal seam is the same one the recorded MP3
// clips will drive later: stepReveal (BeatPlayer steps) + elementReveal (per-
// element bloom), both fed here off the spoken line.

export function FlowPlay() {
  const [flowId, setFlowId] = useState(TABS[0].id);
  const [idx, setIdx] = useState(0);
  const [stepReveal, setStepReveal] = useState<number | null>(99);
  const [elementReveal, setElementReveal] = useState<number | null>(null);
  // Number of words the voice has spoken in the current bubble, or null when not
  // voice-driven. Drives the coach bubble's text in step with the audio.
  const [syncWords, setSyncWords] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  // Off by default: play one beat, then stop and hold on it. Step with next/prev.
  // On: run straight through the whole flow.
  const [autoplay, setAutoplay] = useState(false);
  // Bumped on a per-beat replay so the current beat remounts fresh and its sync
  // plays again from zero without restarting the whole flow.
  const [nonce, setNonce] = useState(0);
  const runRef = useRef(0);
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  const autoplayRef = useRef(false);
  autoplayRef.current = autoplay;
  // The scrollable chat stage. As lines and cards bloom in, keep it pinned to the
  // bottom so the newest content pushes up like a real chat instead of running off
  // below the fold.
  const stageRef = useRef<HTMLDivElement>(null);

  const flow = TABS.find((tab) => tab.id === flowId) ?? TABS[0];
  const playBeats = flow.beats.length ? flow.beats : BEATS;
  const beat = playBeats[Math.min(idx, playBeats.length - 1)];
  const meta = beat.screenId ? METADATA_BY_SCREEN_ID[beat.screenId] : undefined;

  useEffect(() => {
    setIdx(0);
    setPlaying(false);
    stopSpeech();
    runRef.current += 1;
  }, [flowId]);

  useEffect(
    () => () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    },
    [],
  );

  // Auto-scroll to the bottom whenever the revealed content changes (a new bubble,
  // a card blooming, a beat change, or the karaoke growing a bubble).
  useEffect(() => {
    const el = stageRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [stepReveal, elementReveal, syncWords, idx, nonce]);

  async function playBeat(i: number, run: number) {
    const b = playBeats[i];
    // The one shared driver, reading straight off the beat's script[].
    await runBeatScript({
      script: b.script ?? [],
      muted: mutedRef.current,
      setStepReveal,
      setElementReveal,
      setSyncWords,
      shouldStop: () => run !== runRef.current,
    });
  }

  async function playFrom(start: number) {
    const run = ++runRef.current;
    stopSpeech();
    setPlaying(true);
    for (let i = start; i < playBeats.length; i++) {
      if (run !== runRef.current) return;
      setIdx(i);
      await playBeat(i, run);
      if (run !== runRef.current) return;
      // Autoplay off: hold on this beat. On: roll into the next.
      if (!autoplayRef.current) {
        setPlaying(false);
        return;
      }
    }
    setPlaying(false);
  }

  function onPlay() {
    playFrom(0);
  }
  function onPrev() {
    playFrom(Math.max(idx - 1, 0));
  }
  function onNext() {
    playFrom(Math.min(idx + 1, playBeats.length - 1));
  }
  // Replay the current beat from zero: remount it fresh and run its sync again.
  // With autoplay off it holds after; with autoplay on it rolls forward.
  function onReplayBeat() {
    setNonce((n) => n + 1);
    playFrom(idx);
  }
  function onStop() {
    runRef.current += 1;
    stopSpeech();
    setPlaying(false);
  }

  const btn = (primary?: boolean): CSSProperties => ({
    border: 'none',
    borderRadius: 999,
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    background: primary ? '#135BEB' : '#E7ECF4',
    color: primary ? '#fff' : '#1A1D29',
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '24px 16px 60px',
        fontFamily: 'Urbanist, -apple-system, sans-serif',
        background: '#e8ecf1',
      }}
    >
      <div style={{ maxWidth: 520, margin: '0 auto 12px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Guided Growth</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{flow.title}, played</div>
        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2, lineHeight: 1.5 }}>
          The real components, played in order. The component appears, then each element blooms as
          its line is spoken. Voice is the browser reading the lines, a stand-in for the recorded
          MP3.
        </div>
      </div>

      <div
        style={{
          maxWidth: 520,
          margin: '0 auto 14px',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        <select
          value={flowId}
          onChange={(event) => setFlowId(event.target.value as typeof flowId)}
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: 999,
            padding: '9px 14px',
            fontSize: 13,
            fontWeight: 700,
            background: '#fff',
            color: '#1A1D29',
            cursor: 'pointer',
          }}
        >
          {TABS.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
        <button style={btn()} onClick={onPrev}>
          ◀ Prev
        </button>
        <button style={btn(true)} onClick={onNext}>
          Next ▶
        </button>
        <button style={btn()} onClick={onPlay}>
          Play from start
        </button>
        <label
          style={{ fontSize: 12.5, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
        >
          <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} /> Autoplay
        </label>
        <label
          style={{ fontSize: 12.5, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
        >
          <input type="checkbox" checked={muted} onChange={(e) => setMuted(e.target.checked)} /> Mute voice
        </label>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          {idx + 1} / {playBeats.length} · {beat.screenId ?? beat.id}
        </span>
      </div>

      <div
        style={{
          width: 402,
          maxWidth: '100%',
          margin: '0 auto 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#64748b',
            }}
          >
            Beat {idx + 1}
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 15,
              fontWeight: 800,
              color: '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {beat.name}
          </div>
        </div>
        <button
          type="button"
          onClick={playing ? onStop : onReplayBeat}
          title={playing ? 'Stop' : 'Play this beat'}
          aria-label={playing ? 'Stop this beat' : 'Play this beat'}
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: playing ? '#ef4444' : '#135BEB',
            flexShrink: 0,
            boxShadow: '0 8px 18px -12px rgba(15,23,42,0.55)',
          }}
        >
          <Icon icon={playing ? 'mdi:stop' : 'mdi:play'} width={18} height={18} style={{ color: '#fff' }} />
        </button>
      </div>

      <div
        style={{
          width: 402,
          height: 812,
          maxWidth: '100%',
          margin: '0 auto',
          border: '12px solid #0b0d14',
          borderRadius: 54,
          overflow: 'hidden',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 30px 60px -22px rgba(15,23,42,0.45)',
        }}
      >
        {/* Status bar with a dynamic-island notch */}
        <div
          style={{
            position: 'relative',
            height: 44,
            flexShrink: 0,
            background: '#E8EEFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
          }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>9:41</span>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 9,
              transform: 'translateX(-50%)',
              width: 104,
              height: 26,
              borderRadius: 999,
              background: '#0b0d14',
            }}
          />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#0f172a' }}>
            <Icon icon="mdi:signal-cellular-3" width={14} height={14} />
            <Icon icon="mdi:wifi" width={14} height={14} />
            <Icon icon="mdi:battery" width={16} height={16} />
          </span>
        </div>
        {/* Coach header bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 18px',
            flexShrink: 0,
            background: '#E8EEFC',
            borderBottom: '1px solid rgba(15,23,42,0.06)',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Coach</span>
          {meta?.engine && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                fontWeight: 700,
                color: '#6366f1',
                background: 'rgba(99,102,241,0.1)',
                padding: '3px 9px',
                borderRadius: 999,
              }}
            >
              {meta.engine}
            </span>
          )}
        </div>
        {/* Coach-blue main area: the scrollable stage plus the orb docked at the
            bottom, both on one continuous coach gradient (no white bar). */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            background: COACH_BG,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            ref={stageRef}
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '18px 12px 8px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <SpokenWordsCtx.Provider value={syncWords}>
              <IsolatedBeat
                key={`${beat.id}-${nonce}`}
                type={beat.type}
                props={beat.props}
                animated
                stepReveal={stepReveal}
                elementReveal={elementReveal}
              />
            </SpokenWordsCtx.Provider>
          </div>
          {/* The docked orb. Hidden on beats that draw their own orb (the greeting
              and mic-permission), so there is never a second orb. */}
          {!beat.hideOrb && (
            <div style={{ flexShrink: 0, padding: '6px 0 18px', display: 'flex', justifyContent: 'center' }}>
              {playing ? (
                <Orb {...orbSpeaking(84, 'coach')} />
              ) : (
                <Orb {...orbIdle(84, true, true)} />
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <a
          href="/"
          style={{ color: '#135BEB', fontWeight: 700, textDecoration: 'none', fontSize: 12.5 }}
        >
          Annotated render (engine / screen / words)
        </a>
      </div>
    </div>
  );
}
