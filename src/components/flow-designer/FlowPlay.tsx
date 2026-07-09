import { Icon } from '@iconify/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Orb } from '@/components/orb/Orb';
import { orbIdle, orbSpeaking } from '@/components/orb/orbView';
import { SpokenWordsCtx } from './beatKit';
import { runBeatScript, stopSpeech } from './beatNarration';
import { COACH_BG } from './beats/_beatStyle';
import {
  BEATS,
  IsolatedBeat,
  buildConceptRuns,
  CONCEPT_META,
  variationLabel,
} from './FlowDesigner';

// Play mode: runs the real onboarding beats in order in a single phone, speaking
// each opener and per-element line with the browser voice (a stand-in for the
// recorded MP3), and driving the real components' reveal off that voice. Same
// components and same wording (from the metadata) as the annotated view, just
// played instead of stacked. The reveal seam is the same one the recorded MP3
// clips will drive later: stepReveal (BeatPlayer steps) + elementReveal (per-
// element bloom), both fed here off the spoken line.
//
// A category / goal opener is authored as one beat per selection, so playing the
// raw beat list would render the same picker screen 8 (or 30) times in a row.
// Instead Play walks CONCEPT RUNS: each run of same-concept variants is ONE step
// with a variation switcher, so a variant screen plays ONCE and the user flips
// between the openers in place, the same model as the annotated concept groups.
const PLAY_RUNS = buildConceptRuns(BEATS);

export function FlowPlay() {
  // The play step (a concept run), and, per run, which variation is selected.
  const [itemIdx, setItemIdx] = useState(0);
  const [sel, setSel] = useState<Record<number, number>>({});
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
  // The picked variation per run, read inside the async play loop.
  const selRef = useRef<Record<number, number>>({});
  selRef.current = sel;
  // The scrollable chat stage. As lines and cards bloom in, keep it pinned to the
  // bottom so the newest content pushes up like a real chat instead of running off
  // below the fold.
  const stageRef = useRef<HTMLDivElement>(null);

  // Resolve one play step to the beat that actually renders/plays: a concept run
  // resolves to its selected variation; every other run is a single beat.
  function beatOf(i: number): (typeof BEATS)[number] {
    const runItem = PLAY_RUNS[i];
    if (!runItem) return BEATS[0];
    const s = runItem.concept ? Math.min(selRef.current[i] ?? 0, runItem.beats.length - 1) : 0;
    return runItem.beats[s];
  }

  const item = PLAY_RUNS[itemIdx];
  const selIdx = item?.concept ? Math.min(sel[itemIdx] ?? 0, item.beats.length - 1) : 0;
  const beat = item ? item.beats[selIdx] : BEATS[0];

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
  }, [stepReveal, elementReveal, syncWords, itemIdx, selIdx, nonce]);

  async function playStep(i: number, run: number) {
    const b = beatOf(i);
    // The one shared driver, reading straight off the beat's script[].
    await runBeatScript({
      script: b.script ?? [],
      muted: mutedRef.current,
      setStepReveal,
      setElementReveal,
      setSyncWords,
      shouldStop: () => run !== runRef.current,
      beatType: b.type,
    });
  }

  async function playFrom(start: number) {
    const run = ++runRef.current;
    stopSpeech();
    setPlaying(true);
    for (let i = start; i < PLAY_RUNS.length; i++) {
      if (run !== runRef.current) return;
      setItemIdx(i);
      await playStep(i, run);
      if (run !== runRef.current) return;
      // Autoplay off: hold on this step. On: roll into the next.
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
    playFrom(Math.max(itemIdx - 1, 0));
  }
  function onNext() {
    playFrom(Math.min(itemIdx + 1, PLAY_RUNS.length - 1));
  }
  // Replay the current step from zero: remount it fresh and run its sync again.
  // With autoplay off it holds after; with autoplay on it rolls forward.
  function onReplayBeat() {
    setNonce((n) => n + 1);
    playFrom(itemIdx);
  }
  // Flip to another variation of the current concept run and replay it in place.
  function pickVariation(v: number) {
    setSel((m) => ({ ...m, [itemIdx]: v }));
    selRef.current = { ...selRef.current, [itemIdx]: v };
    setNonce((n) => n + 1);
    playFrom(itemIdx);
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
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Onboarding, played</div>
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
        <button style={btn()} onClick={onPrev}>
          ◀ Prev
        </button>
        <button style={btn(true)} onClick={onNext}>
          Next ▶
        </button>
        <button style={btn()} onClick={onReplayBeat}>
          Restart beat
        </button>
        <button style={btn()} onClick={onPlay}>
          Play from start
        </button>
        <label
          style={{
            fontSize: 12.5,
            color: '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={autoplay}
            onChange={(e) => setAutoplay(e.target.checked)}
          />{' '}
          Autoplay
        </label>
        <label
          style={{
            fontSize: 12.5,
            color: '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <input type="checkbox" checked={muted} onChange={(e) => setMuted(e.target.checked)} />{' '}
          Mute voice
        </label>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          {itemIdx + 1} / {PLAY_RUNS.length} · {beat.screenId ?? beat.id}
        </span>
        {beat.engine && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#6366f1',
              background: 'rgba(99,102,241,0.1)',
              padding: '3px 9px',
              borderRadius: 999,
            }}
          >
            {beat.engine}
          </span>
        )}
      </div>

      {/* Variation switcher: shown only on a concept step (category / goal
          opener). Flip which category/goal plays on this one screen, in place. */}
      {item?.concept && (
        <div
          style={{
            maxWidth: 520,
            margin: '0 auto 14px',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>
            {CONCEPT_META[item.concept].title}
          </span>
          <button
            type="button"
            style={btn()}
            onClick={() => pickVariation((selIdx - 1 + item.beats.length) % item.beats.length)}
            aria-label="Previous variation"
          >
            ◀
          </button>
          <select
            value={selIdx}
            onChange={(e) => pickVariation(Number(e.target.value))}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#0f172a',
              padding: '7px 10px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              background: '#fff',
              cursor: 'pointer',
              maxWidth: 260,
            }}
          >
            {item.beats.map((b, i) => (
              <option key={b.id} value={i}>
                {i + 1}. {variationLabel(b)}
              </option>
            ))}
          </select>
          <button
            type="button"
            style={btn()}
            onClick={() => pickVariation((selIdx + 1) % item.beats.length)}
            aria-label="Next variation"
          >
            ▶
          </button>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            variation {selIdx + 1} / {item.beats.length}
          </span>
        </div>
      )}

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
          {/* Just "Coach", so the phone mirrors the real app screen exactly. The
              engine chip lives in the controls row above the phone. */}
          <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Coach</span>
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
                key={`${beat.id}-${selIdx}-${nonce}`}
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
            <div
              style={{
                flexShrink: 0,
                padding: '6px 0 18px',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
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
