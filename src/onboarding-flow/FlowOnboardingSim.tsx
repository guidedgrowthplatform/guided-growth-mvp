/**
 * FlowOnboardingSim — voice simulator for the chat-native flow.
 *
 * Runs the REAL engine, renderer, and components with in-memory persistence and
 * no login. Soniox voice-in (Listen) streams the transcript and drives the
 * brain-dump parse as it comes in. Jumps straight to the Advanced brain-dump
 * beat. Local QA only, at /onboarding-flow-sim.
 *
 * Brain dump: the habits parse live (instant regex + AI refine, persistent) and
 * render IN the chat feed as real HabitScheduleCards under the user's blue
 * speech bubble, pushing the conversation up like a real chat. Each card carries
 * the Build/Break toggle and the day picker; days only auto-fill when concrete.
 *
 * Dev: window.__simDump('go to the gym monday, no caffeine') injects a transcript
 * without a mic (the bottom is voice-only by design).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useVoiceInCapture } from '@/hooks/useVoiceInCapture';
import { HabitScheduleCard } from '@/components/onboarding/HabitScheduleCard';
import { VOICE_IN_ENABLED } from '@/lib/config/voice';
import { resolveHabitPolarity } from './curatedHabitPolarity';
import { parseHabitsRegex } from './parseBrainDumpRegex';
import { useLocalPersistence } from './persistence';
import { FlowRenderer } from './renderer/FlowRenderer';
import type { BeatCapture, FlowNode } from './types';
import { skimAndPublish } from './useLiveSkimmer';
import { useFlow } from './useFlow';
import { useFlowOrchestrator } from './useFlowOrchestrator';

type Polarity = 'positive' | 'negative' | null;

interface ParsedHabit {
  name: string;
  days?: number[]; // 0=Sun..6=Sat, only auto-filled when concrete
  polarity: Polarity;
}

const PARSE_DEBOUNCE_MS = 600;

function isBrainDumpBeat(componentType?: string): boolean {
  return componentType === 'coach-bubble';
}

function normName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Capitalize the first letter for display ("go to the gym" -> "Go to the gym").
function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Fast-forward straight to the Advanced brain-dump beat: seed the pre-dump beats
// (auth/mic/profile, and pick the brain-dump path at the fork). Null at and after.
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
  const nodeId = node?.id ?? null;
  const onBrainDump = isBrainDumpBeat(node?.componentType);

  // Fast-forward to the brain dump.
  const advancedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!node) return;
    const cap = fastForwardCapture(node);
    if (!cap) return;
    if (advancedRef.current.has(node.id)) return;
    advancedRef.current.add(node.id);
    orchestrator.capture(cap);
  }, [node, orchestrator]);

  // ---- brain-dump parse state ---------------------------------------------
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [habits, setHabits] = useState<ParsedHabit[]>([]);
  const [parsing, setParsing] = useState(false);

  const dumpRef = useRef('');
  const committedRef = useRef(''); // Soniox is per-utterance; accumulate finals.
  const parseInFlight = useRef(false);
  const pendingText = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ONE persistent accumulator, keyed by normalized name in first-seen order.
  // Habits only get ADDED or refined, never removed, so nothing disappears.
  // Manual day / polarity picks always win over a re-parse.
  const habitsRef = useRef<Map<string, ParsedHabit>>(new Map());
  const orderRef = useRef<string[]>([]);
  const manualDays = useRef<Map<string, number[]>>(new Map());
  const manualPolarity = useRef<Map<string, Polarity>>(new Map());

  const recompute = useCallback(() => {
    const list: ParsedHabit[] = [];
    for (const key of orderRef.current) {
      const h = habitsRef.current.get(key);
      if (!h) continue;
      list.push({
        ...h,
        days: manualDays.current.get(key) ?? h.days,
        polarity: manualPolarity.current.has(key) ? manualPolarity.current.get(key)! : h.polarity,
      });
    }
    setHabits(list);
  }, []);

  // Add/refine habits. Each parsed item becomes its OWN card. Voice has no
  // punctuation, so the regex can't split a run-on; a long single name is a
  // run-on blob, dropped here and left for the AI (which splits properly).
  const addParsed = useCallback(
    (parsed: { name: string; days?: number[] }[], fromAI: boolean) => {
      for (const p of parsed) {
        const name = p.name.trim();
        if (!name) continue;
        if (!fromAI && name.split(/\s+/).length > 4) continue; // regex run-on blob
        const key = normName(name);
        if (!key) continue;
        const existing = habitsRef.current.get(key);
        habitsRef.current.set(key, {
          // The AI name is authoritative; the regex keeps an existing name.
          name: fromAI ? name : (existing?.name ?? name),
          days: p.days ?? existing?.days,
          polarity: resolveHabitPolarity(name).polarity,
        });
        if (!orderRef.current.includes(key)) orderRef.current.push(key);
      }
      recompute();
    },
    [recompute],
  );

  // Reset per beat.
  const lastNodeRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastNodeRef.current !== nodeId) {
      lastNodeRef.current = nodeId;
      setInterim('');
      setHabits([]);
      dumpRef.current = '';
      committedRef.current = '';
      habitsRef.current = new Map();
      orderRef.current = [];
      manualDays.current = new Map();
      manualPolarity.current = new Map();
    }
  }, [nodeId]);

  const drive = useCallback(
    (t: string) => skimAndPublish(orchestrator.currentNode ?? null, orchestrator.answers, t),
    [orchestrator],
  );

  // The model is the splitter: it turns run-on speech into separate habits.
  const parseDump = useCallback(
    async (full: string) => {
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
        if (Array.isArray(d.habits)) addParsed(d.habits, true);
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
    },
    [addParsed],
  );

  // Instant local pass: clean splits ("and"/commas) show immediately; run-ons
  // are left to the AI.
  const runRegex = useCallback(
    (text: string) => {
      addParsed(parseHabitsRegex(text), false);
    },
    [addParsed],
  );

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
        manualDays.current.set(normName(h.name), days);
        return { ...h, days };
      }),
    );
  }, []);

  const setPolarity = useCallback((index: number, polarity: Polarity) => {
    setHabits((prev) =>
      prev.map((h, idx) => {
        if (idx !== index) return h;
        manualPolarity.current.set(normName(h.name), polarity);
        return { ...h, polarity };
      }),
    );
  }, []);

  // Dev-only console hook so we can inject a dump without a mic.
  useEffect(() => {
    (window as unknown as { __simDump?: (t: string) => void }).__simDump = (t: string) => {
      committedRef.current = t;
      runRegex(t);
      void parseDump(t);
    };
  }, [runRegex, parseDump]);

  const { isListening } = useVoiceInCapture({
    active: listening,
    vapiStatus: 'idle',
    onInterim: (t) => {
      setErr(null);
      setInterim(t);
      if (onBrainDump) {
        const full = `${committedRef.current} ${t}`.trim();
        runRegex(full);
        scheduleParse(full);
      } else drive(t);
    },
    onTranscript: (t) => {
      if (onBrainDump) {
        committedRef.current = `${committedRef.current} ${t}`.trim();
        setInterim('');
        runRegex(committedRef.current);
        void parseDump(committedRef.current);
      } else {
        setInterim(t);
        drive(t);
      }
    },
    onError: (m) => setErr(m),
  });

  // ---- the live chat feed (speech bubble + forming cards) ------------------
  const afterFeed = useMemo(() => {
    if (!onBrainDump) return null;
    return (
      <div className="flex flex-col gap-3">
        {interim && (
          <div className="ml-auto max-w-[80%] rounded-[20px] bg-primary px-4 py-2.5 text-[15px] text-white">
            {interim}
          </div>
        )}
        {habits.map((h, i) => (
          <HabitScheduleCard
            key={normName(h.name)}
            habitName={capitalize(h.name)}
            polarity={h.polarity === 'negative' ? 'break' : 'build'}
            selectedDays={new Set(h.days ?? [])}
            onChangePolarity={(p) => setPolarity(i, p === 'break' ? 'negative' : 'positive')}
            onToggleDay={(d) => toggleDay(i, d)}
            onEdit={() => {}}
          />
        ))}
      </div>
    );
  }, [onBrainDump, interim, habits, setPolarity, toggleDay]);

  return (
    <div className="bg-background flex h-screen w-screen flex-col">
      <div className="min-h-0 flex-1">
        <FlowRenderer
          orchestrator={orchestrator}
          afterFeed={afterFeed}
          feedKey={`${habits.length}:${interim.length}:${parsing ? 1 : 0}`}
        />
      </div>

      <div style={{ flexShrink: 0, padding: '8px 12px 14px', background: 'transparent' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          {(err || !VOICE_IN_ENABLED) && (
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>
              {!VOICE_IN_ENABLED && 'voice-in disabled (set VITE_STATE3_ENABLED=true)'}
              {err && `  ·  ${err}`}
            </div>
          )}
          <button
            type="button"
            onClick={() => setListening((v) => !v)}
            style={{
              height: 48,
              width: '100%',
              borderRadius: 14,
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 500,
              color: '#fff',
              background: listening ? '#d83a3a' : '#2447e6',
            }}
          >
            {listening ? '◼ Stop' : isListening ? 'Listening…' : '🎤 Listen (Soniox)'}
          </button>
        </div>
      </div>
    </div>
  );
}
