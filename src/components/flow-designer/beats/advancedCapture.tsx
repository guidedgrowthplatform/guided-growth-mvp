import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { HabitScheduleCard, type HabitPolarity } from '@/components/onboarding/HabitScheduleCard';
import { classifyHabitPolarity } from '@/components/onboarding/habitPolarity';
import { BeatPlayer, useAnimations, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';
import { FONT, PRIMARY as BLUE, INK, SUBTLE, SURFACE, BORDER, SPACE } from './_beatStyle';

// Advanced path capture, redesigned 2026-06-29.
//
// As the user reads the habits they already track, each one forms live as the
// SAME card used for the schedule (HabitScheduleCard), minus the day circles
// (showDays={false}): the habit name, an auto-classified Build/Break chip, a
// pencil, and a delete. The coach does NOT ask build-vs-break per habit. It is
// inferred from the wording (classifyHabitPolarity) and the user can change any
// chip. When every habit is in, the coach names the build/break read and asks
// the user to approve the whole set. On approve, the next beat (advanced-frequency)
// grows the day picker out of these same cards.
//
// Framing (locked 2026-06-29): less is more at the start, they can build on it
// later. The check-ins are already habits, so two or three more is plenty. The
// coach never says tap/scroll/click/press/swipe.

const SAMPLE = [
  '10-minute walk after lunch',
  'No screens after 10 PM',
  'Meditate for 5 minutes',
  'Plan meals on Sunday',
  'Phone away while working',
];

// showDays is false on these cards, so selectedDays is unused; one stable empty
// set avoids re-allocating per render.
const EMPTY_DAYS: Set<number> = new Set();

interface Entry {
  name: string;
  polarity: HabitPolarity;
}

function makeEntries(names: string[]): Entry[] {
  return names.map((name) => ({ name, polarity: classifyHabitPolarity(name) }));
}

// One card per captured habit: the Build/Break chip (auto-set, flippable), a
// pencil, and a delete. No day circles here; the frequency beat grows those out.
function CardList({
  entries,
  onFlip,
  onRemove,
  animate,
}: {
  entries: Entry[];
  onFlip: (idx: number, polarity: HabitPolarity) => void;
  onRemove: (idx: number) => void;
  animate: boolean;
}) {
  return (
    <div className="flex w-full max-w-[360px] flex-col gap-3">
      {entries.map((e, idx) => (
        <div key={e.name} style={animate ? { animation: 'ggCardIn 300ms ease-out both' } : undefined}>
          <HabitScheduleCard
            habitName={e.name}
            polarity={e.polarity}
            selectedDays={EMPTY_DAYS}
            onChangePolarity={(p) => onFlip(idx, p)}
            onToggleDay={() => undefined}
            onEdit={() => undefined}
            onDelete={() => onRemove(idx)}
            showDays={false}
          />
        </div>
      ))}
    </div>
  );
}

// A slim listening header: the mic, the current status, and a breathing dot
// while more habits are still coming in.
function ListeningHeader({ listening, current }: { listening: boolean; current?: string }) {
  return (
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
          {listening ? (current ? 'Got it, keep going...' : 'Listening for your habits...') : 'All captured'}
        </div>
        {listening && current && (
          <div style={{ fontFamily: FONT, fontSize: 13, color: SUBTLE, marginTop: 2 }}>
            &ldquo;{current}&rdquo;
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
  );
}

// Mic-on path: habits land one at a time as cards while the listening header
// shows what is being heard.
function LiveScan() {
  const anims = useAnimations();
  const flow = useFlowState();
  const [entries, setEntries] = useState<Entry[]>(() => makeEntries(SAMPLE));
  const [revealed, setRevealed] = useState(anims ? 0 : SAMPLE.length);

  useEffect(() => {
    if (!anims) {
      setRevealed(SAMPLE.length);
      return;
    }
    setRevealed(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setRevealed(i);
      if (i >= SAMPLE.length) window.clearInterval(id);
    }, 950);
    return () => window.clearInterval(id);
  }, [anims]);

  // Feed captured names into shared flow state as they land, so the frequency
  // beat and the plan recap list the real habits, not the sample fallback.
  useEffect(() => {
    flow?.setHabits(entries.slice(0, Math.min(revealed, entries.length)).map((e) => e.name));
    // react to the capture count only; flow is read at call time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, entries]);

  const shown = entries.slice(0, Math.min(revealed, entries.length));
  const listening = anims && revealed < entries.length;
  const current = listening && SAMPLE[revealed] ? SAMPLE[revealed] : undefined;

  function flip(idx: number, polarity: HabitPolarity) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, polarity } : e)));
  }
  function remove(idx: number) {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.lg }}>
      <ListeningHeader listening={listening} current={current} />
      <CardList entries={shown} onFlip={flip} onRemove={remove} animate />
      <style>{`@keyframes ggScanPulse{0%,100%{opacity:.3}50%{opacity:1}}@keyframes ggCardIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

// Mic-off fallback: the user types habits one per line; on submit they become
// the same cards with the same auto-classified Build/Break chips.
function TypeInstead() {
  const flow = useFlowState();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');
  const [entries, setEntries] = useState<Entry[] | null>(null);

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
    const next = makeEntries(lines);
    setEntries(next);
    flow?.setHabits(next.map((e) => e.name));
  }

  function flip(idx: number, polarity: HabitPolarity) {
    setEntries((prev) => (prev ? prev.map((e, i) => (i === idx ? { ...e, polarity } : e)) : prev));
  }
  function remove(idx: number) {
    setEntries((prev) => {
      if (!prev) return prev;
      const next = prev.filter((_, i) => i !== idx);
      flow?.setHabits(next.map((e) => e.name));
      return next;
    });
  }

  const lines = parseLines(value);

  if (entries) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.lg }}>
        <CardList entries={entries} onFlip={flip} onRemove={remove} animate />
        <style>{`@keyframes ggCardIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
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

// Renders the live scan by default; the user can reveal the type fallback via a
// "Type instead" toggle.
function CaptureWithFallback() {
  const [typing, setTyping] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.lg }}>
      {typing ? <TypeInstead /> : <LiveScan />}

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
      // Opener: invite them to read their habits, framed "less is more, start
      // small." Real copy comes from beatContexts.ts; this is a placeholder.
      id: 'ask',
      speaker: 'coach',
      say:
        props?.coachLine ??
        'Read me the habits you already track. Less is more to start, you can always build on it.',
    },
    {
      // Capture surface: cards form live (mic) or from typed lines (mic-off),
      // each with an auto-classified Build/Break chip the user can flip.
      id: 'scan',
      speaker: 'coach',
      render: <CaptureWithFallback />,
    },
    {
      // Close: name the build/break read and ask for one approval over the whole
      // set, no per-habit questions. Real copy comes from beatContexts.ts.
      id: 'close',
      speaker: 'coach',
      say:
        props?.closeCoachLine ??
        'Those are all in, and I marked each as build or break. Tell me if any look wrong. If they are good, we will set the days next.',
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
