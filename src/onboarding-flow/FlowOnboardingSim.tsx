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
  confirmed?: boolean; // the AI has vouched for this one (sticky, never pruned)
}

// Short enough to fire on a natural micro-pause mid-sentence (cards fill in with
// a small lag while you talk), long enough that a continuous sentence doesn't
// thrash the parser.
const PARSE_DEBOUNCE_MS = 450;

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

  // Add/refine habits. Each parsed item becomes its OWN card. The regex is an
  // instant OPTIMISTIC pass; the AI is AUTHORITATIVE. Anything the AI vouches for
  // is sticky (confirmed). When the AI returns, any optimistic regex card it did
  // NOT reconfirm (a disfluency or false start the regex let through) is pruned,
  // so junk self-heals within a beat while real habits never disappear.
  const addParsed = useCallback(
    (parsed: { name: string; days?: number[] }[], fromAI: boolean, confirm = false) => {
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
          // Sticky only when the AI vouched for it on a FINAL utterance. Interim
          // guesses stay optimistic so a fuller pass can supersede them.
          confirmed: existing?.confirmed || (fromAI && confirm),
        });
        if (!orderRef.current.includes(key)) orderRef.current.push(key);
      }
      // Supersede premature partials: drop any unconfirmed, untouched card whose
      // name is a strict word-prefix of a fuller card ("Go" once "Go to the gym"
      // lands, "Read" once "Read before bed" lands). This only removes the early
      // guess that grew into a longer one; it never touches unrelated cards, so
      // a wrong or empty AI pass can't wipe the regex's real catches.
      for (const short of [...orderRef.current]) {
        const sh = habitsRef.current.get(short);
        if (!sh || sh.confirmed) continue;
        if (manualDays.current.has(short) || manualPolarity.current.has(short)) continue;
        const supersededBy = orderRef.current.some(
          (long) => long !== short && long.startsWith(`${short} `),
        );
        if (supersededBy) {
          habitsRef.current.delete(short);
          orderRef.current = orderRef.current.filter((k) => k !== short);
        }
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
    async (full: string, confirm = false) => {
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
        if (Array.isArray(d.habits)) addParsed(d.habits, true, confirm);
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

  // Wipe everything captured this beat (cards + transcript), without a reload.
  // Useful after a test run so leftover state never carries into the next one.
  const clearAll = useCallback(() => {
    parseAbort.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    habitsRef.current = new Map();
    orderRef.current = [];
    manualDays.current = new Map();
    manualPolarity.current = new Map();
    deletedRef.current = new Set();
    committedRef.current = '';
    dumpRef.current = '';
    setCommitted('');
    setInterim('');
    setHabits([]);
  }, []);

  // Dev-only console hooks so we can drive the sim without a mic.
  //  __simDump(t)   — inject a finished transcript (skips streaming).
  //  __simStream(t) — replay the real voice cadence: interim words tick into the
  //                   bubble, then one final fires the parse. Use this to confirm
  //                   partial words never spawn cards.
  useEffect(() => {
    const w = window as unknown as {
      __simDump?: (t: string) => void;
      __simStream?: (t: string, ms?: number) => Promise<void>;
      __simState?: () => unknown;
    };
    w.__simState = () => ({
      committed: committedRef.current,
      order: [...orderRef.current],
      habits: [...habitsRef.current.entries()],
      deleted: [...deletedRef.current],
    });
    w.__simDump = (t: string) => {
      committedRef.current = `${committedRef.current} ${t}`.trim();
      setCommitted(committedRef.current);
      setInterim('');
      runRegex(committedRef.current);
      void parseDump(committedRef.current, true);
    };
    w.__simStream = async (t: string, ms = 110) => {
      // Mirror the real handlers exactly: each interim tick streams a word into
      // the bubble AND schedules a debounced parse (so a slow cadence with gaps
      // > the debounce fills cards mid-sentence), then a final commits + parses.
      const words = t.split(/\s+/).filter(Boolean);
      for (let i = 1; i <= words.length; i++) {
        const partial = words.slice(0, i).join(' ');
        setInterim(partial);
        scheduleParse(`${committedRef.current} ${partial}`.trim());
        await new Promise((r) => setTimeout(r, ms));
      }
      committedRef.current = `${committedRef.current} ${t}`.trim(); // final utterance
      setCommitted(committedRef.current);
      setInterim('');
      if (debounceRef.current) clearTimeout(debounceRef.current);
      runRegex(committedRef.current);
      void parseDump(committedRef.current, true);
    };
  }, [runRegex, parseDump, scheduleParse]);

  const { isListening } = useVoiceInCapture({
    active: listening,
    vapiStatus: 'idle',
    onInterim: (t) => {
      setErr(null);
      setInterim(t); // every word streams into the speech bubble
      if (onBrainDump) {
        // Parse the LIVE text on a short debounce: it fires on a natural
        // micro-pause mid-sentence, so cards fill in with a small lag instead of
        // waiting for a full stop. We don't run the instant regex on interim (a
        // half-typed trailing word would flicker); the debounced AI is the
        // splitter and the authority, and it prunes its own mistakes.
        scheduleParse(`${committedRef.current} ${t}`.trim());
      } else {
        drive(t);
      }
    },
    onTranscript: (t) => {
      if (onBrainDump) {
        committedRef.current = `${committedRef.current} ${t}`.trim();
        setCommitted(committedRef.current);
        setInterim('');
        // A finalized utterance is a real pause: parse it now (not debounced) and
        // CONFIRM, so these habits become sticky. Regex gives an instant card.
        if (debounceRef.current) clearTimeout(debounceRef.current);
        runRegex(committedRef.current);
        void parseDump(committedRef.current, true);
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
          {habits.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              style={{
                height: 36,
                width: '100%',
                marginBottom: 8,
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.12)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                color: '#444',
                background: 'rgba(255,255,255,0.7)',
              }}
            >
              ↺ Clear all
            </button>
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
