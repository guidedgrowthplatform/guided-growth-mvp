import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { BeatPlayer, useAnimations, type BeatDef, type BeatStep } from '../beatKit';

const FONT = 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const BLUE = 'rgb(19, 91, 235)';

// The advanced (exp) side of the fork: the user reads the habits they already
// track and the coach captures them line by line, filing each under its real
// category as it goes. This previews that live scan: sample lines are captured
// one at a time and organized by category. Each captured line maps to one of the
// real onboarding categories.
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Listening surface: the mic + the line currently being heard. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          borderRadius: 18,
          border: `1.5px solid ${listening ? BLUE : 'rgba(15,23,42,0.10)'}`,
          background: '#fff',
          boxShadow: '0 4px 16px -8px rgba(15,23,42,0.10)',
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
          <div style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: 'rgb(15,23,42)' }}>
            {listening
              ? captured.length
                ? 'Got it, keep going...'
                : 'Listening for your habits...'
              : 'All captured'}
          </div>
          {listening && SAMPLE[n] && (
            <div style={{ fontFamily: FONT, fontSize: 13, color: 'rgb(100,116,139)', marginTop: 2 }}>
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
        <div key={g.category} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: BLUE,
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
                gap: 10,
                padding: '10px 14px',
                borderRadius: 14,
                background: 'rgba(19,91,235,0.06)',
                animation: 'ggScanIn 280ms ease-out',
              }}
            >
              <Icon icon="mdi:check-circle" width={18} height={18} style={{ color: BLUE, flexShrink: 0 }} />
              <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: 'rgb(15,23,42)' }}>
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

function AdvancedCaptureBeat(props?: Record<string, string>) {
  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say:
        props?.coachLine ??
        "Perfect. Read me the habits you already track and I'll organize them as you go.",
    },
    { id: 'scan', speaker: 'coach', render: <LiveScan /> },
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
