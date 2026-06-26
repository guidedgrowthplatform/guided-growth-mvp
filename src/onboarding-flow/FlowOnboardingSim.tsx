/**
 * FlowOnboardingSim — type-to-fill simulator for the chat-native flow.
 *
 * Same engine, renderer, and REAL components as FlowOnboardingPreview, but with
 * a text box standing in for the voice the user would speak. As you type, the
 * live skimmer ghost-fills the active beat's real card (age, gender, category,
 * goals, habits with polarity). Tap the card's own Continue to commit + advance.
 *
 * For local QA only, mounted at /onboarding-flow-sim. No login, in-memory
 * persistence, no Vapi. Use this when voice is unavailable.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useVoiceInCapture } from '@/hooks/useVoiceInCapture';
import { VOICE_IN_ENABLED } from '@/lib/config/voice';
import { resolveHabitPolarity } from './curatedHabitPolarity';
import { IntroGate } from './IntroGate';
import { useLocalPersistence } from './persistence';
import { FlowRenderer } from './renderer/FlowRenderer';
import { skimAndPublish } from './useLiveSkimmer';
import { useFlow } from './useFlow';
import { useFlowOrchestrator, type FlowOrchestrator } from './useFlowOrchestrator';

interface ParsedHabit {
  name: string;
  // Only set when the user explicitly stated it. Blank => ask at review.
  frequency?: string;
  polarity: 'positive' | 'negative' | null;
}

const FREQUENCY_OPTIONS = ['daily', 'weekdays', 'weekends', '3x/week', 'weekly'];

// The brain-dump beat: free-text/voice dump that a fast model parses into habits.
function isBrainDumpBeat(componentType?: string): boolean {
  return componentType === 'coach-bubble';
}

function PolarityTag({ polarity }: { polarity: ParsedHabit['polarity'] }) {
  const neg = polarity === 'negative';
  const unknown = polarity == null;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: unknown ? '#6b7280' : neg ? '#92400e' : '#166534',
      }}
    >
      {unknown ? '?' : neg ? '↓ break' : '↑ do'}
    </span>
  );
}

// As the user dumps: show the habits, with frequency ONLY when they said it.
function HabitChips({ habits, parsing }: { habits: ParsedHabit[]; parsing: boolean }) {
  if (!habits.length && !parsing) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>
        Habits I'm hearing{parsing ? ' …' : ''}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {habits.map((h, i) => (
          <div
            key={`${h.name}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.12)',
              background: '#f5f6f8',
              fontSize: 13,
            }}
          >
            <PolarityTag polarity={h.polarity} />
            <span style={{ fontWeight: 500 }}>{h.name}</span>
            {h.frequency ? (
              <span style={{ opacity: 0.6 }}>· {h.frequency}</span>
            ) : (
              <span style={{ color: '#b45309', fontSize: 11 }}>· needs frequency</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// When the user is done: confirm the habits and fill the missing frequencies.
function HabitReview({
  habits,
  onChangeFrequency,
  onConfirm,
  confirmed,
}: {
  habits: ParsedHabit[];
  onChangeFrequency: (index: number, frequency: string) => void;
  onConfirm: () => void;
  confirmed: boolean;
}) {
  const missing = habits.filter((h) => !h.frequency).length;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
        {confirmed
          ? `Saved ${habits.length} habits`
          : `Do these look right? ${missing ? `Set how often for ${missing}.` : ''}`}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {habits.map((h, i) => (
          <div
            key={`${h.name}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 10,
              border: `1px solid ${!h.frequency ? '#f59e0b' : 'rgba(0,0,0,0.12)'}`,
              background: '#fff',
              fontSize: 13,
            }}
          >
            <PolarityTag polarity={h.polarity} />
            <span style={{ fontWeight: 500, flex: 1 }}>{h.name}</span>
            <select
              value={h.frequency ?? ''}
              onChange={(e) => onChangeFrequency(i, e.target.value)}
              disabled={confirmed}
              style={{ fontSize: 13, padding: '4px 6px', borderRadius: 8 }}
            >
              <option value="" disabled>
                how often?
              </option>
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {!confirmed && (
        <button
          type="button"
          onClick={onConfirm}
          disabled={habits.some((h) => !h.frequency)}
          style={{
            marginTop: 8,
            height: 40,
            width: '100%',
            borderRadius: 12,
            border: 'none',
            cursor: habits.some((h) => !h.frequency) ? 'default' : 'pointer',
            fontSize: 15,
            fontWeight: 500,
            color: '#fff',
            background: habits.some((h) => !h.frequency) ? '#9aa6e6' : '#2447e6',
          }}
        >
          These look right
        </button>
      )}
    </div>
  );
}

function SimDriverBar({ orchestrator }: { orchestrator: FlowOrchestrator }) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [habits, setHabits] = useState<ParsedHabit[]>([]);
  const [parsing, setParsing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reviewHabits, setReviewHabits] = useState<ParsedHabit[]>([]);
  const node = orchestrator.currentNode;
  const nodeId = node?.id ?? null;
  const onBrainDump = isBrainDumpBeat(node?.componentType);

  // Accumulated dump text + parse coalescing (one in-flight call, latest queued).
  const dumpRef = useRef('');
  const parseInFlight = useRef(false);
  const pendingText = useRef<string | null>(null);

  // Clear inputs when the beat advances so each beat starts fresh.
  const lastNodeRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastNodeRef.current !== nodeId) {
      lastNodeRef.current = nodeId;
      setText('');
      setInterim('');
      setHabits([]);
      setReviewing(false);
      setConfirmed(false);
      setReviewHabits([]);
      dumpRef.current = '';
    }
  }, [nodeId]);

  // The skimmer runs against the LIVE node/answers (read fresh, not closed over).
  const drive = useCallback(
    (t: string) => skimAndPublish(orchestrator.currentNode ?? null, orchestrator.answers, t),
    [orchestrator],
  );

  // Fast-model brain-dump parse: one call per completed sentence, coalesced.
  const parseDump = useCallback(async (full: string) => {
    if (parseInFlight.current) {
      pendingText.current = full;
      return;
    }
    parseInFlight.current = true;
    setParsing(true);
    try {
      const r = await fetch('/api/sim-parse-habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: full }),
      });
      const d = (await r.json()) as { habits?: Omit<ParsedHabit, 'polarity'>[] };
      if (Array.isArray(d.habits)) {
        setHabits(d.habits.map((h) => ({ ...h, polarity: resolveHabitPolarity(h.name).polarity })));
      }
    } catch {
      // best-effort; leave prior habits up
    } finally {
      parseInFlight.current = false;
      setParsing(false);
      if (pendingText.current) {
        const next = pendingText.current;
        pendingText.current = null;
        void parseDump(next);
      }
    }
  }, []);

  // Real Soniox voice-in: while listening, the partial transcript streams here
  // (onInterim) and drives the skimmer as it comes in, just like the app.
  const { isListening } = useVoiceInCapture({
    active: listening,
    vapiStatus: 'idle',
    onInterim: (t) => {
      setErr(null);
      setInterim(t);
      drive(t);
    },
    onTranscript: (t) => {
      setInterim(t);
      if (onBrainDump) {
        const tt = t.trim();
        if (tt && !dumpRef.current.endsWith(tt)) {
          dumpRef.current = (dumpRef.current + ' ' + tt).trim();
        }
        void parseDump(dumpRef.current);
      } else {
        drive(t);
      }
    },
    onError: (m) => setErr(m),
  });

  const onChange = (v: string) => {
    setText(v);
    if (onBrainDump) {
      dumpRef.current = v;
      void parseDump(v);
    } else {
      drive(v);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        padding: '10px 12px',
        background: 'var(--color-surface, #fff)',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>
          {node ? `beat: ${node.name}` : ''}
          {!VOICE_IN_ENABLED && '  ·  voice-in disabled (set VITE_STATE3_ENABLED=true)'}
          {err && `  ·  ${err}`}
        </div>

        {onBrainDump &&
          (reviewing ? (
            <HabitReview
              habits={reviewHabits}
              confirmed={confirmed}
              onChangeFrequency={(i, f) =>
                setReviewHabits((prev) => prev.map((h, idx) => (idx === i ? { ...h, frequency: f } : h)))
              }
              onConfirm={() => setConfirmed(true)}
            />
          ) : (
            <>
              <HabitChips habits={habits} parsing={parsing} />
              {habits.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setReviewHabits(habits);
                    setReviewing(true);
                  }}
                  style={{
                    marginBottom: 8,
                    height: 38,
                    padding: '0 16px',
                    borderRadius: 12,
                    border: '1px solid rgba(0,0,0,0.15)',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  Done, review {habits.length} habits
                </button>
              )}
            </>
          ))}

        {(listening || interim) && (
          <div
            style={{
              marginBottom: 8,
              padding: '8px 12px',
              borderRadius: 12,
              background: '#2447e6',
              color: '#fff',
              fontSize: 15,
              minHeight: 20,
              opacity: interim ? 1 : 0.5,
            }}
          >
            {interim || (isListening ? 'Listening…' : 'Starting mic…')}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setListening((v) => !v)}
            style={{
              height: 44,
              padding: '0 16px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 500,
              color: '#fff',
              background: listening ? '#d83a3a' : '#2447e6',
              whiteSpace: 'nowrap',
            }}
          >
            {listening ? '◼ Stop' : '🎤 Listen (Soniox)'}
          </button>
          <input
            value={text}
            onChange={(e) => onChange(e.target.value)}
            placeholder="…or type to test the skimmer without voice"
            style={{
              flex: 1,
              height: 44,
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.15)',
              padding: '0 14px',
              fontSize: 15,
              outline: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Beats with no spoken data to capture: in the sim we auto-advance them so the
// walk lands straight on the data-capture cards (auth/mic touch Supabase and
// need a real login, which this sim does not have).
const PASS_THROUGH = new Set(['auth', 'mic-permission', 'primary-button']);

export function FlowOnboardingSim() {
  useEffect(() => {
    if (!useAuthStore.getState().anonId) {
      useAuthStore.setState({ anonId: `sim-${crypto.randomUUID()}` });
    }
  }, []);

  const { flow, tag } = useFlow(null);
  const persistence = useLocalPersistence();
  const orchestrator = useFlowOrchestrator(flow, persistence, { flowTag: tag });

  // Auto-advance pass-through beats once each (no double-advance).
  const node = orchestrator.currentNode;
  const advancedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!node || !PASS_THROUGH.has(node.componentType)) return;
    if (advancedRef.current.has(node.id)) return;
    advancedRef.current.add(node.id);
    orchestrator.capture({ data: {} });
  }, [node, orchestrator]);

  return (
    <div className="bg-background flex h-screen w-screen flex-col">
      <div className="min-h-0 flex-1">
        <IntroGate>
          <FlowRenderer orchestrator={orchestrator} />
        </IntroGate>
      </div>
      <SimDriverBar orchestrator={orchestrator} />
    </div>
  );
}
