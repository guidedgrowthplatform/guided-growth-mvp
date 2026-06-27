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
  const [interim, setInterim] = useState(''); // live words, not yet finalized
  const [committed, setCommitted] = useState(''); // finalized utterances so far
  const [err, setErr] = useState<string | null>(null);
  const [habits, setHabits] = useState<ParsedHabit[]>([]);
  const [parsing, setParsing] = useState(false);

  const dumpRef = useRef('');
  const committedRef = useRef(''); // Soniox is per-utterance; accumulate finals.
  const parseAbort = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ONE persistent accumulator, keyed by normalized name in first-seen order.
  // Habits only get ADDED or refined, never removed, so nothing disappears.
  // Manual day / polarity picks always win over a re-parse.
  const habitsRef = useRef<Map<string, ParsedHabit>>(new Map());
  const orderRef = useRef<string[]>([]);
  const manualDays = useRef<Map<string, number[]>>(new Map());
  const manualPolarity = useRef<Map<string, Polarity>>(new Map());
  // Deleted keys are remembered so a re-parse over the same transcript can't
  // resurrect a habit the user removed.
  const deletedRef = useRef<Set<string>>(new Set());

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
        if (deletedRef.current.has(key)) continue; // user removed it; don't resurrect
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
      setCommitted('');
      setHabits([]);
      dumpRef.current = '';
      committedRef.current = '';
      habitsRef.current = new Map();
      orderRef.current = [];
      manualDays.current = new Map();
      manualPolarity.current = new Map();
      deletedRef.current = new Set();
    }
  }, [nodeId]);

  const drive = useCallback(
    (t: string) => skimAndPublish(orchestrator.currentNode ?? null, orchestrator.answers, t),
    [orchestrator],
  );

  // The model is the splitter: it turns run-on speech into separate habits.
  // Abort-latest (not a queue): a newer parse cancels the one in flight, and a
  // hard timeout guarantees it can never wedge "Parsing…" forever.
  const parseDump = useCallback(
    async (full: string) => {
      if (!full.trim()) return;
      parseAbort.current?.abort();
      const ac = new AbortController();
      parseAbort.current = ac;
      const timeout = setTimeout(() => ac.abort(), 8000);
      setParsing(true);
      try {
        const r = await fetch('/api/sim-parse-habits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: full }),
          signal: ac.signal,
        });
        const d = (await r.json()) as { habits?: { name: string; days?: number[] }[] };
        if (Array.isArray(d.habits)) addParsed(d.habits, true);
      } catch {
        // aborted or failed; leave the existing cards up
      } finally {
        clearTimeout(timeout);
        if (parseAbort.current === ac) {
          parseAbort.current = null;
          setParsing(false);
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

  // Delete a card. The real beat opens DeleteHabitModal + dataService.deleteHabit;
  // the sim has no persisted habits, so it just drops it from the accumulator and
  // marks the key deleted so a re-parse can't bring it back.
  const removeHabit = useCallback(
    (index: number) => {
      const h = habits[index];
      if (!h) return;
      const key = normName(h.name);
      deletedRef.current.add(key);
      habitsRef.current.delete(key);
      orderRef.current = orderRef.current.filter((k) => k !== key);
      manualDays.current.delete(key);
      manualPolarity.current.delete(key);
      recompute();
    },
    [habits, recompute],
  );

  // Dev-only console hooks so we can drive the sim without a mic.
  //  __simDump(t)   — inject a finished transcript (skips streaming).
  //  __simStream(t) — replay the real voice cadence: interim words tick into the
  //                   bubble, then one final fires the parse. Use this to confirm
  //                   partial words never spawn cards.
  useEffect(() => {
    const w = window as unknown as {
      __simDump?: (t: string) => void;
      __simStream?: (t: string, ms?: number) => Promise<void>;
    };
    w.__simDump = (t: string) => {
      committedRef.current = `${committedRef.current} ${t}`.trim();
      setCommitted(committedRef.current);
      setInterim('');
      runRegex(committedRef.current);
      void parseDump(committedRef.current);
    };
    w.__simStream = async (t: string, ms = 110) => {
      const words = t.split(/\s+/).filter(Boolean);
      for (let i = 1; i <= words.length; i++) {
        setInterim(words.slice(0, i).join(' ')); // interim grows, no parsing
        await new Promise((r) => setTimeout(r, ms));
      }
      committedRef.current = `${committedRef.current} ${t}`.trim(); // final utterance
      setCommitted(committedRef.current);
      setInterim('');
      runRegex(committedRef.current);
      scheduleParse(committedRef.current);
    };
  }, [runRegex, parseDump, scheduleParse]);

  const { isListening } = useVoiceInCapture({
    active: listening,
    vapiStatus: 'idle',
    onInterim: (t) => {
      setErr(null);
      // Brain dump: interim words ONLY stream into the speech bubble. Parsing a
      // half-spoken phrase ("I want to...") is what spawned the half-baked cards,
      // so we never parse interim, only finalized utterances below.
      setInterim(t);
      if (!onBrainDump) drive(t);
    },
    onTranscript: (t) => {
      if (onBrainDump) {
        committedRef.current = `${committedRef.current} ${t}`.trim();
        setCommitted(committedRef.current);
        setInterim('');
        // Finalized text is whole utterances, so names come out clean. Regex is
        // instant; the AI refine is debounced so several quick finals coalesce.
        runRegex(committedRef.current);
        scheduleParse(committedRef.current);
      } else {
        setInterim(t);
        drive(t);
      }
    },
    onError: (m) => setErr(m),
  });

  // ---- the live chat feed (speech bubble + forming cards) ------------------
  // The bubble holds the FULL running transcript (every finalized word plus the
  // live interim tail), growing like one real chat message as the user talks.
  const transcript = [committed, interim].filter(Boolean).join(' ').trim();
  const afterFeed = useMemo(() => {
    if (!onBrainDump) return null;
    return (
      <div className="flex flex-col gap-3">
        {transcript && (
          <div className="ml-auto max-w-[80%] rounded-[20px] bg-primary px-4 py-2.5 text-[15px] text-white">
            {transcript}
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
            onDelete={() => removeHabit(i)}
          />
        ))}
      </div>
    );
  }, [onBrainDump, transcript, habits, setPolarity, toggleDay, removeHabit]);

  return (
    <div className="bg-background flex h-screen w-screen flex-col">
      <div className="min-h-0 flex-1">
        <FlowRenderer
          orchestrator={orchestrator}
          afterFeed={afterFeed}
          feedKey={`${habits.length}:${transcript.length}:${parsing ? 1 : 0}`}
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
