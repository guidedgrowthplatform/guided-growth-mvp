/**
 * FlowOnboardingSim — voice/type simulator for the chat-native flow.
 *
 * Runs the REAL engine, renderer, and components with in-memory persistence and
 * no login. Soniox voice-in (Listen) streams the transcript and drives the
 * skimmer / brain-dump parse as it comes in. Jumps straight to the Advanced
 * brain-dump beat for fast iteration. Local QA only, at /onboarding-flow-sim.
 *
 * Brain dump flow (two steps, per Yair):
 *   1. capture  — the habits appear live as you talk; confirm the list.
 *   2. schedule — set the specific days for each (real DayPicker). Days only
 *      auto-fill when concrete ("daily", "weekdays", "Mon/Wed"); vague counts
 *      ("three times a week") stay empty for the user to pick.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useVoiceInCapture } from '@/hooks/useVoiceInCapture';
import { formatCadence } from '@/components/onboarding/constants';
import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import { DayPicker } from '@/components/ui/DayPicker';
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
  // Specific weekday indices (0=Sun..6=Sat). Only auto-filled when concrete.
  days?: number[];
  polarity: 'positive' | 'negative' | null;
}

type DumpPhase = 'capture' | 'schedule' | 'done';

const PARSE_DEBOUNCE_MS = 600;

function isBrainDumpBeat(componentType?: string): boolean {
  return componentType === 'coach-bubble';
}

function polarityMeta(p: ParsedHabit['polarity']): { icon: string; label: string } {
  if (p === 'negative') return { icon: 'mdi:close-circle-outline', label: 'Break' };
  if (p == null) return { icon: 'mdi:help-circle-outline', label: 'Confirm type' };
  return { icon: 'mdi:checkbox-marked-circle-outline', label: 'Do' };
}

function btn(primary: boolean, enabled = true): React.CSSProperties {
  return {
    marginTop: 8,
    height: 40,
    width: '100%',
    borderRadius: 12,
    border: primary ? 'none' : '1px solid rgba(0,0,0,0.15)',
    cursor: enabled ? 'pointer' : 'default',
    fontSize: 15,
    fontWeight: 500,
    color: primary ? '#fff' : '#111',
    background: primary ? (enabled ? '#2447e6' : '#9aa6e6') : '#fff',
  };
}

// Step 1 reveals the habit cards live; step 2 reveals the day pickers to fill.
function HabitCards({
  habits,
  parsing,
  phase,
  onToggleDay,
  onNext,
  onDone,
}: {
  habits: ParsedHabit[];
  parsing: boolean;
  phase: DumpPhase;
  onToggleDay: (index: number, day: number) => void;
  onNext: () => void;
  onDone: () => void;
}) {
  if (!habits.length && !parsing) return null;
  const allHaveDays = habits.length > 0 && habits.every((h) => (h.days?.length ?? 0) > 0);
  const header =
    phase === 'done'
      ? `All set, ${habits.length} habits`
      : phase === 'capture'
        ? `Are these your habits?${parsing ? ' …' : ''}`
        : 'Pick the days for each';
  return (
    <div style={{ marginBottom: 8, maxHeight: '48vh', overflowY: 'auto' }}>
      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>{header}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {habits.map((h, i) => {
          const meta = polarityMeta(h.polarity);
          const sel = new Set(h.days ?? []);
          const cadence = sel.size
            ? formatCadence(sel)
            : phase === 'capture'
              ? 'Days next'
              : 'Pick days';
          return (
            <div key={`${h.name}-${i}`}>
              <PlanSummaryCard
                icon={meta.icon}
                typeLabel="Habit"
                title={h.name}
                cadence={cadence}
                rule={meta.label}
              />
              {phase === 'schedule' && (
                <div style={{ marginTop: 6 }}>
                  <DayPicker selectedDays={sel} onToggleDay={(d) => onToggleDay(i, d)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {phase === 'capture' && (
        <button type="button" onClick={onNext} style={btn(true)}>
          These are my habits
        </button>
      )}
      {phase === 'schedule' && (
        <button type="button" onClick={onDone} disabled={!allHaveDays} style={btn(true, allHaveDays)}>
          {allHaveDays ? 'Done' : 'Set the days to finish'}
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
  const [phase, setPhase] = useState<DumpPhase>('capture');
  const node = orchestrator.currentNode;
  const nodeId = node?.id ?? null;
  const onBrainDump = isBrainDumpBeat(node?.componentType);

  const dumpRef = useRef('');
  const parseInFlight = useRef(false);
  const pendingText = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Days the user set by hand, so a re-parse never wipes them.
  const manualDays = useRef<Map<string, number[]>>(new Map());

  const lastNodeRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastNodeRef.current !== nodeId) {
      lastNodeRef.current = nodeId;
      setText('');
      setInterim('');
      setHabits([]);
      setPhase('capture');
      dumpRef.current = '';
      manualDays.current = new Map();
    }
  }, [nodeId]);

  const drive = useCallback(
    (t: string) => skimAndPublish(orchestrator.currentNode ?? null, orchestrator.answers, t),
    [orchestrator],
  );

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
      const d = (await r.json()) as { habits?: { name: string; days?: number[] }[] };
      if (Array.isArray(d.habits)) {
        setHabits(
          d.habits.map((h) => ({
            name: h.name,
            days: manualDays.current.get(h.name) ?? h.days,
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

  const toggleDay = useCallback((index: number, day: number) => {
    setHabits((prev) =>
      prev.map((h, idx) => {
        if (idx !== index) return h;
        const set = new Set(h.days ?? []);
        if (set.has(day)) set.delete(day);
        else set.add(day);
        const days = [...set].sort((a, b) => a - b);
        manualDays.current.set(h.name, days);
        return { ...h, days };
      }),
    );
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

        {onBrainDump && (
          <HabitCards
            habits={habits}
            parsing={parsing}
            phase={phase}
            onToggleDay={toggleDay}
            onNext={() => setPhase('schedule')}
            onDone={() => setPhase('done')}
          />
        )}

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
// starts where the work is. Returns null at the brain dump and after.
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
