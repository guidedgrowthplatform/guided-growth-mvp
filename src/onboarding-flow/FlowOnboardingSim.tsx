/**
 * FlowOnboardingSim — voice/type simulator for the chat-native flow.
 *
 * Runs the REAL engine, renderer, and components with in-memory persistence and
 * no login. Soniox voice-in (Listen) streams the transcript and drives the
 * skimmer / brain-dump parse as it comes in. For fast iteration this jumps
 * straight to the Advanced brain-dump beat. Local QA only, at /onboarding-flow-sim.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useVoiceInCapture } from '@/hooks/useVoiceInCapture';
import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import { VOICE_IN_ENABLED } from '@/lib/config/voice';
import { resolveHabitPolarity } from './curatedHabitPolarity';
import { useLocalPersistence } from './persistence';
import { FlowRenderer } from './renderer/FlowRenderer';
import type { BeatCapture, FlowNode } from './types';
import { skimAndPublish } from './useLiveSkimmer';
import { useFlow } from './useFlow';
import { useFlowOrchestrator, type FlowOrchestrator } from './useFlowOrchestrator';

interface ParsedHabit {
  name: string;
  // Only set when the user explicitly stated it, or after the user picks it.
  frequency?: string;
  polarity: 'positive' | 'negative' | null;
}

const FREQUENCY_OPTIONS = ['daily', 'weekdays', 'weekends', '3x/week', 'weekly'];
const PARSE_DEBOUNCE_MS = 600;

function isBrainDumpBeat(componentType?: string): boolean {
  return componentType === 'coach-bubble';
}

function polarityMeta(p: ParsedHabit['polarity']): { icon: string; label: string } {
  if (p === 'negative') return { icon: 'mdi:close-circle-outline', label: 'Break' };
  if (p == null) return { icon: 'mdi:help-circle-outline', label: 'Confirm type' };
  return { icon: 'mdi:checkbox-marked-circle-outline', label: 'Do' };
}

// Real habit cards (PlanSummaryCard) that fill live. Frequency shows when stated;
// when blank, inline pills let the user set it right on the card (no extra step).
function HabitCards({
  habits,
  parsing,
  onSetFrequency,
}: {
  habits: ParsedHabit[];
  parsing: boolean;
  onSetFrequency: (index: number, frequency: string) => void;
}) {
  if (!habits.length && !parsing) return null;
  return (
    <div style={{ marginBottom: 8, maxHeight: '46vh', overflowY: 'auto' }}>
      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>
        Your habits{parsing ? ' …' : ''}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {habits.map((h, i) => {
          const meta = polarityMeta(h.polarity);
          return (
            <div key={`${h.name}-${i}`}>
              <PlanSummaryCard
                icon={meta.icon}
                typeLabel="Habit"
                title={h.name}
                cadence={h.frequency ?? 'How often?'}
                rule={meta.label}
              />
              {!h.frequency && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {FREQUENCY_OPTIONS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => onSetFrequency(i, f)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 999,
                        border: '1px solid #f59e0b',
                        background: '#fffbeb',
                        color: '#92400e',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
  const node = orchestrator.currentNode;
  const nodeId = node?.id ?? null;
  const onBrainDump = isBrainDumpBeat(node?.componentType);

  const dumpRef = useRef('');
  const parseInFlight = useRef(false);
  const pendingText = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Frequencies the user picked by hand, so a re-parse never wipes them.
  const manualFreq = useRef<Map<string, string>>(new Map());

  // Reset per beat.
  const lastNodeRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastNodeRef.current !== nodeId) {
      lastNodeRef.current = nodeId;
      setText('');
      setInterim('');
      setHabits([]);
      dumpRef.current = '';
      manualFreq.current = new Map();
    }
  }, [nodeId]);

  const drive = useCallback(
    (t: string) => skimAndPublish(orchestrator.currentNode ?? null, orchestrator.answers, t),
    [orchestrator],
  );

  // Fast-model brain-dump parse. Coalesced (one in flight, latest queued) and
  // merged with the user's manual frequency picks.
  const parseDump = useCallback(async (full: string) => {
    if (!full.trim()) return;
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
      const d = (await r.json()) as { habits?: { name: string; frequency?: string }[] };
      if (Array.isArray(d.habits)) {
        setHabits(
          d.habits.map((h) => ({
            name: h.name,
            frequency: manualFreq.current.get(h.name) ?? h.frequency,
            polarity: resolveHabitPolarity(h.name).polarity,
          })),
        );
      }
    } catch {
      // best-effort; leave prior cards up
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

  // Scan often: debounce ~600ms so habits show as fast as possible while talking.
  const scheduleParse = useCallback(
    (t: string) => {
      dumpRef.current = t;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void parseDump(dumpRef.current), PARSE_DEBOUNCE_MS);
    },
    [parseDump],
  );

  const setFrequency = useCallback((index: number, frequency: string) => {
    setHabits((prev) => {
      const h = prev[index];
      if (h) manualFreq.current.set(h.name, frequency);
      return prev.map((x, idx) => (idx === index ? { ...x, frequency } : x));
    });
  }, []);

  const { isListening } = useVoiceInCapture({
    active: listening,
    vapiStatus: 'idle',
    onInterim: (t) => {
      setErr(null);
      setInterim(t);
      if (onBrainDump) scheduleParse(t);
      else drive(t);
    },
    onTranscript: (t) => {
      setInterim(t);
      if (onBrainDump) {
        dumpRef.current = t;
        void parseDump(t);
      } else {
        drive(t);
      }
    },
    onError: (m) => setErr(m),
  });

  const onChange = (v: string) => {
    setText(v);
    if (onBrainDump) scheduleParse(v);
    else drive(v);
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

        {onBrainDump && <HabitCards habits={habits} parsing={parsing} onSetFrequency={setFrequency} />}

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
            placeholder="…or type to test without voice"
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

// Fast-forward straight to the Advanced brain-dump beat: seed the pre-dump beats
// (auth/mic/profile, and pick the brain-dump path at the fork) so each test
// starts where the work is. Returns null at the brain dump and after, so nothing
// past it is auto-advanced.
function fastForwardCapture(node: FlowNode): BeatCapture | null {
  switch (node.componentType) {
    case 'auth':
    case 'mic-permission':
    case 'primary-button':
      return { data: {} };
    case 'profile-input':
      return { data: { age: 30, gender: 'Male' } };
    case 'path-selection':
      return { data: {}, path: 'braindump' };
    default:
      return null;
  }
}

export function FlowOnboardingSim() {
  useEffect(() => {
    if (!useAuthStore.getState().anonId) {
      useAuthStore.setState({ anonId: `sim-${crypto.randomUUID()}` });
    }
  }, []);

  const { flow, tag } = useFlow(null);
  const persistence = useLocalPersistence();
  const orchestrator = useFlowOrchestrator(flow, persistence, { flowTag: tag });

  const node = orchestrator.currentNode;
  const advancedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!node) return;
    const cap = fastForwardCapture(node);
    if (!cap) return;
    if (advancedRef.current.has(node.id)) return;
    advancedRef.current.add(node.id);
    orchestrator.capture(cap);
  }, [node, orchestrator]);

  return (
    <div className="bg-background flex h-screen w-screen flex-col">
      <div className="min-h-0 flex-1">
        <FlowRenderer orchestrator={orchestrator} />
      </div>
      <SimDriverBar orchestrator={orchestrator} />
    </div>
  );
}
