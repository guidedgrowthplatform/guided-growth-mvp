import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { BeatPlayer, useAnimations, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';
import { FONT, PRIMARY as BLUE, INK, SUBTLE, SURFACE, BORDER, SPACE } from './_beatStyle';

// The advanced path of the fork: the user reads the habits they already track
// and the coach captures them line by line, filing each under its real category
// as it goes. This previews the live scan: sample lines are captured one at a
// time and organized by category. Each captured line maps to one of the real
// onboarding categories.
//
// Framing (locked 2026-06-29): encourage less is more at the start. They can
// always build on it later. The check-ins are already habits, so two or three
// more is plenty. The coach does NOT say tap/scroll/click/press/swipe.
const SAMPLE: { line: string; category: string }[] = [
  { line: '10-minute walk after lunch', category: 'Move more' },
  { line: 'No screens after 10 PM', category: 'Sleep better' },
  { line: 'Meditate for 5 minutes', category: 'Reduce stress' },
  { line: 'Plan meals on Sunday', category: 'Eat better' },
  { line: 'Phone away while working', category: 'Improve focus' },
];

function LiveScan() {
  // Reveal the captured lines one at a time while animating, all at once when
  // paused (global or per-tile freeze), so a frozen tile shows the full result.
  const anims = useAnimations();
  const flow = useFlowState();
  const [n, setN] = useState(anims ? 0 : SAMPLE.length);
  useEffect(() => {
    if (!anims) {
      setN(SAMPLE.length);
      return;
    }
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= SAMPLE.length) window.clearInterval(id);
    }, 950);
    return () => window.clearInterval(id);
  }, [anims]);

  // Feed the captured habits into shared flow state as they land, so the next
  // beat (the schedule card) lists the real captured habits, not a sample.
  useEffect(() => {
    flow?.setHabits(SAMPLE.slice(0, n).map((s) => s.line));
    // react to the capture count only; flow is read at call time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const captured = SAMPLE.slice(0, n);
  const listening = anims && n < SAMPLE.length;

  // Group captured lines by category, keeping first-seen order.
  const groups: { category: string; lines: string[] }[] = [];
  captured.forEach((c) => {
    let g = groups.find((x) => x.category === c.category);
    if (!g) {
      g = { category: c.category, lines: [] };
      groups.push(g);
    }
    g.lines.push(c.line);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.lg }}>
      {/* Listening surface: the mic + the line currently being heard. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.md,
          padding: `${SPACE.md}px ${SPACE.lg}px`,
          borderRadius: 20,
          border: `1.5px solid ${listening ? BLUE : BORDER}`,
          background: SURFACE,
          boxShadow: '0 4px 20px -8px rgba(15,23,42,0.12)',
          transition: 'border-color 200ms ease-out',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: listening ? BLUE : 'rgba(19,91,235,0.10)',
            transition: 'background 200ms ease-out',
          }}
        >
          <Icon icon="mdi:microphone" width={20} height={20} style={{ color: listening ? '#fff' : BLUE }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: INK }}>
            {listening
              ? captured.length
                ? 'Got it, keep going...'
                : 'Listening for your habits...'
              : 'All captured'}
          </div>
          {listening && SAMPLE[n] && (
            <div style={{ fontFamily: FONT, fontSize: 13, color: SUBTLE, marginTop: 2 }}>
              &ldquo;{SAMPLE[n].line}&rdquo;
            </div>
          )}
        </div>
        {listening && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              flexShrink: 0,
              background: BLUE,
              animation: 'ggScanPulse 1s ease-in-out infinite',
            }}
          />
        )}
      </div>

      {/* Captured, organized by category as they land. */}
      {groups.map((g) => (
        <div key={g.category} style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: BLUE,
              paddingLeft: 4,
            }}
          >
            {g.category}
          </div>
          {g.lines.map((line) => (
            <div
              key={line}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.md,
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                borderRadius: 16,
                background: 'rgba(19,91,235,0.06)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                animation: 'ggScanIn 280ms ease-out',
              }}
            >
              <Icon icon="mdi:check-circle" width={18} height={18} style={{ color: BLUE, flexShrink: 0 }} />
              <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}>
                {line}
              </span>
            </div>
          ))}
        </div>
      ))}

      <style>{`@keyframes ggScanPulse{0%,100%{opacity:.3}50%{opacity:1}}@keyframes ggScanIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

// Fallback input surface for the mic-off path. The user types habits one per
// line and the list feeds the same flow.setHabits channel that LiveScan uses,
// so the downstream advanced-habits and advanced-frequency beats receive the
// real captured habits rather than the sample fallback.
function TypeInstead() {
  const flow = useFlowState();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.focus();
  }, []);

  function parseLines(raw: string): string[] {
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }

  function handleSubmit() {
    const lines = parseLines(value);
    if (!lines.length) return;
    flow?.setHabits(lines);
    setSubmitted(true);
  }

  const lines = parseLines(value);

  if (submitted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        {lines.map((line) => (
          <div
            key={line}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.md,
              padding: `${SPACE.md}px ${SPACE.lg}px`,
              borderRadius: 16,
              background: 'rgba(19,91,235,0.06)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              animation: 'ggScanIn 280ms ease-out',
            }}
          >
            <Icon icon="mdi:check-circle" width={18} height={18} style={{ color: BLUE, flexShrink: 0 }} />
            <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}>
              {line}
            </span>
          </div>
        ))}
        <style>{`@keyframes ggScanIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={'One habit per line, for example:\n10-minute walk after lunch\nNo screens after 10 PM'}
        rows={5}
        style={{
          fontFamily: FONT,
          fontSize: 14.5,
          fontWeight: 500,
          color: INK,
          lineHeight: 1.6,
          padding: `${SPACE.md}px ${SPACE.lg}px`,
          borderRadius: 20,
          border: `1.5px solid ${BLUE}`,
          background: SURFACE,
          boxShadow: '0 4px 20px -8px rgba(15,23,42,0.12)',
          resize: 'none',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!lines.length}
        style={{
          fontFamily: FONT,
          fontSize: 14.5,
          fontWeight: 700,
          color: lines.length ? '#fff' : 'rgba(15,23,42,0.35)',
          background: lines.length ? BLUE : 'rgba(15,23,42,0.07)',
          border: 'none',
          borderRadius: 14,
          padding: '13px 20px',
          cursor: lines.length ? 'pointer' : 'default',
          transition: 'background 180ms ease-out, color 180ms ease-out',
          textAlign: 'center',
        }}
      >
        {lines.length ? `Save ${lines.length} habit${lines.length === 1 ? '' : 's'}` : 'Add at least one habit'}
      </button>
    </div>
  );
}

// Wrapper that renders LiveScan by default and lets the user reveal TypeInstead
// via a "Type instead" toggle. When the user has already submitted via typing,
// the toggle is hidden so the confirmed state stays visible.
function CaptureWithFallback() {
  const [typing, setTyping] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.lg }}>
      {typing ? <TypeInstead /> : <LiveScan />}

      {/* Toggle between voice and text paths. */}
      <button
        type="button"
        onClick={() => setTyping((v) => !v)}
        style={{
          fontFamily: FONT,
          fontSize: 13,
          fontWeight: 600,
          color: SUBTLE,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: `${SPACE.xs}px 0`,
          textAlign: 'center',
          textDecoration: 'underline',
          textDecorationColor: 'rgba(100,116,139,0.35)',
          textUnderlineOffset: 3,
        }}
      >
        {typing ? 'Use mic instead' : 'Type instead'}
      </button>
    </div>
  );
}

function AdvancedCaptureBeat(props?: Record<string, string>) {
  const steps: BeatStep[] = [
    {
      // Opener: invite them to share their habits. The framing here is
      // "less is more, start small." Real copy comes from beatContexts.ts;
      // this string is a placeholder that matches the spec direction.
      id: 'ask',
      speaker: 'coach',
      say:
        props?.coachLine ??
        'Share the habits you already track. Less is more to start. You can always add more later.',
    },
    {
      // Capture surface: mic-on path uses the live scan, mic-off path uses the
      // text input. Both feed the same captured-habits list downstream.
      id: 'scan',
      speaker: 'coach',
      render: <CaptureWithFallback />,
    },
    {
      // Closing nudge: once all lines are in, reinforce the small-start framing
      // so they do not feel pressure to load up everything now.
      // Real copy comes from beatContexts.ts; placeholder matches spec direction.
      id: 'close',
      speaker: 'coach',
      say:
        props?.closeCoachLine ??
        "Good. That's a solid place to start. You can grow it from here.",
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const advancedCaptureBeat: BeatDef = {
  type: 'advanced-capture',
  group: 'Onboarding',
  label: 'Advanced capture',
  Comp: AdvancedCaptureBeat,
};

export default advancedCaptureBeat;
