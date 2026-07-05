import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseBrainDump } from '@/api/parseHabits';
import { HabitScheduleCard } from '@/components/onboarding/HabitScheduleCard';
import { Button } from '@/components/ui/Button';
import { useVoiceInCapture } from '@/hooks/useVoiceInCapture';
import { VOICE_IN_ENABLED } from '@/lib/config/voice';
import type { ParsedHabit as ApiParsedHabit } from '@gg/shared/types';
import { parseHabitsRegex } from './parseBrainDumpRegex';
import type { BeatCapture, FlowNode } from './types';

type Polarity = 'positive' | 'negative';

interface CardHabit {
  name: string;
  days?: number[];
  polarity: Polarity;
  confirmed?: boolean;
}

interface IncomingHabit {
  name: string;
  days?: number[];
  polarity?: Polarity;
}

interface BrainDumpCaptureProps {
  node: FlowNode;
  onCapture?: (capture: BeatCapture) => void;
  showControls?: boolean;
  enableDevHooks?: boolean;
  onNonBrainDumpText?: (text: string) => void;
}

const PARSE_DEBOUNCE_MS = 450;
const PARSE_TIMEOUT_MS = 8000;

// Instant-tier polarity for the regex pass only; the AI pass overrides with the
// server's habitType and a manual chip flip beats both.
const NEGATIVE_LEAD =
  /^(?:quit|stop|no |no-|less |avoid|cut\s+(?:down|back|out)|limit|reduce|skip)/i;

function leadPolarity(name: string): Polarity {
  return NEGATIVE_LEAD.test(name) ? 'negative' : 'positive';
}

function habitTypeToPolarity(h: ApiParsedHabit): Polarity | undefined {
  if (h.habitType === 'binary_avoid') return 'negative';
  if (h.habitType === 'binary_do') return 'positive';
  return undefined;
}

function normName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `brain-dump-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useBrainDumpCapture({
  node,
  onCapture,
  showControls = true,
  enableDevHooks = false,
  onNonBrainDumpText,
}: BrainDumpCaptureProps) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [committed, setCommitted] = useState('');
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [habits, setHabits] = useState<CardHabit[]>([]);
  const [parsing, setParsing] = useState(false);

  const sessionIdRef = useRef(createSessionId());
  const dumpRef = useRef('');
  const committedRef = useRef('');
  const parseAbort = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const habitsRef = useRef<Map<string, CardHabit>>(new Map());
  const orderRef = useRef<string[]>([]);
  const manualDays = useRef<Map<string, number[]>>(new Map());
  const manualPolarity = useRef<Map<string, Polarity>>(new Map());
  const deletedRef = useRef<Set<string>>(new Set());

  const recompute = useCallback(() => {
    const list: CardHabit[] = [];
    for (const key of orderRef.current) {
      const h = habitsRef.current.get(key);
      if (!h) continue;
      list.push({
        ...h,
        days: manualDays.current.get(key) ?? h.days,
        polarity: manualPolarity.current.get(key) ?? h.polarity,
      });
    }
    setHabits(list);
  }, []);

  const addParsed = useCallback(
    (parsed: IncomingHabit[], fromAI: boolean, confirm = false) => {
      for (const p of parsed) {
        const name = p.name.trim();
        if (!name) continue;
        // Regex tier caps name length; the AI may legitimately return longer.
        if (!fromAI && name.split(/\s+/).length > 4) continue;
        const key = normName(name);
        if (!key) continue;
        if (deletedRef.current.has(key)) continue;
        const existing = habitsRef.current.get(key);
        habitsRef.current.set(key, {
          name: fromAI ? name : (existing?.name ?? name),
          days: p.days ?? existing?.days,
          polarity: fromAI
            ? (p.polarity ?? existing?.polarity ?? leadPolarity(name))
            : (existing?.polarity ?? p.polarity ?? leadPolarity(name)),
          confirmed: existing?.confirmed || (fromAI && confirm),
        });
        if (!orderRef.current.includes(key)) orderRef.current.push(key);
      }

      // An interim partial cards "go to the" a beat before "go to the gym"
      // lands; the longer name supersedes the stub unless the user touched it.
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

  useEffect(() => {
    setInterim('');
    setCommitted('');
    setDraft('');
    setHabits([]);
    dumpRef.current = '';
    committedRef.current = '';
    habitsRef.current = new Map();
    orderRef.current = [];
    manualDays.current = new Map();
    manualPolarity.current = new Map();
    deletedRef.current = new Set();
  }, [node.id]);

  const parseDump = useCallback(
    async (full: string, confirm = false) => {
      if (!full.trim()) return;
      parseAbort.current?.abort();
      const ac = new AbortController();
      parseAbort.current = ac;
      const timeout = setTimeout(() => ac.abort(), PARSE_TIMEOUT_MS);
      setParsing(true);
      try {
        const parsed = await parseBrainDump(full, sessionIdRef.current, ac.signal);
        addParsed(
          parsed.map((h) => ({ name: h.name, days: h.days, polarity: habitTypeToPolarity(h) })),
          true,
          confirm,
        );
      } catch {
        // Keep the cards already on screen when a parse is aborted or fails.
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

  const handleFinalText = useCallback(
    (t: string) => {
      committedRef.current = `${committedRef.current} ${t}`.trim();
      setCommitted(committedRef.current);
      setInterim('');
      if (debounceRef.current) clearTimeout(debounceRef.current);
      runRegex(committedRef.current);
      void parseDump(committedRef.current, true);
    },
    [parseDump, runRegex],
  );

  // Typed input mirrors the voice legs: each keystroke is an interim (instant
  // regex cards via the debounced parse), Enter/Add is the finalized chunk.
  const handleDraftChange = useCallback(
    (t: string) => {
      setDraft(t);
      setInterim(t);
      runRegex(`${committedRef.current} ${t}`.trim());
      scheduleParse(`${committedRef.current} ${t}`.trim());
    },
    [runRegex, scheduleParse],
  );

  const handleDraftSubmit = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    setDraft('');
    handleFinalText(t);
  }, [draft, handleFinalText]);

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
    setDraft('');
    setHabits([]);
  }, []);

  useEffect(() => {
    if (!enableDevHooks) return;
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
    w.__simDump = (t: string) => handleFinalText(t);
    w.__simStream = async (t: string, ms = 110) => {
      const words = t.split(/\s+/).filter(Boolean);
      for (let i = 1; i <= words.length; i++) {
        const partial = words.slice(0, i).join(' ');
        setInterim(partial);
        scheduleParse(`${committedRef.current} ${partial}`.trim());
        await new Promise((resolve) => setTimeout(resolve, ms));
      }
      handleFinalText(t);
    };
  }, [enableDevHooks, handleFinalText, scheduleParse]);

  useEffect(() => {
    return () => {
      parseAbort.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const { isListening } = useVoiceInCapture({
    active: listening,
    vapiStatus: 'idle',
    onInterim: (t) => {
      setErr(null);
      setInterim(t);
      runRegex(`${committedRef.current} ${t}`.trim());
      scheduleParse(`${committedRef.current} ${t}`.trim());
      onNonBrainDumpText?.(t);
    },
    onTranscript: handleFinalText,
    onError: (m) => setErr(m),
  });

  const transcript = [committed, interim].filter(Boolean).join(' ').trim();
  const canSubmit = transcript.trim().length > 0 || habits.length > 0;

  const submit = useCallback(() => {
    if (!canSubmit) return;
    onCapture?.({ data: { brainDumpText: transcript.trim() } });
  }, [canSubmit, onCapture, transcript]);

  const feed = useMemo(
    () => (
      <BrainDumpCaptureFeed
        transcript={transcript}
        habits={habits}
        parsing={parsing}
        onSetPolarity={setPolarity}
        onToggleDay={toggleDay}
        onRemoveHabit={removeHabit}
      />
    ),
    [habits, parsing, removeHabit, setPolarity, toggleDay, transcript],
  );

  const controls = showControls ? (
    <BrainDumpCaptureControls
      err={err}
      draft={draft}
      hasHabits={habits.length > 0 || transcript.length > 0}
      isListening={isListening}
      listening={listening}
      canSubmit={canSubmit}
      onDraftChange={handleDraftChange}
      onDraftSubmit={handleDraftSubmit}
      onClear={clearAll}
      onSubmit={submit}
      onToggleListening={() => setListening((v) => !v)}
    />
  ) : null;

  return {
    feed,
    controls,
    transcript,
    habits,
    parsing,
    clearAll,
    handleFinalText,
    scheduleParse,
    setListening,
    isListening,
    listening,
    err,
    submit,
  };
}

function BrainDumpCaptureFeed({
  transcript,
  habits,
  parsing,
  onSetPolarity,
  onToggleDay,
  onRemoveHabit,
}: {
  transcript: string;
  habits: CardHabit[];
  parsing: boolean;
  onSetPolarity: (index: number, polarity: Polarity) => void;
  onToggleDay: (index: number, day: number) => void;
  onRemoveHabit: (index: number) => void;
}) {
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
          onChangePolarity={(p) => onSetPolarity(i, p === 'break' ? 'negative' : 'positive')}
          onToggleDay={(d) => onToggleDay(i, d)}
          onEdit={() => {}}
          onDelete={() => onRemoveHabit(i)}
        />
      ))}
      {parsing && habits.length === 0 && transcript && (
        <div className="text-center text-[12px] text-content-secondary">Parsing...</div>
      )}
    </div>
  );
}

function BrainDumpCaptureControls({
  err,
  draft,
  hasHabits,
  isListening,
  listening,
  canSubmit,
  onDraftChange,
  onDraftSubmit,
  onClear,
  onSubmit,
  onToggleListening,
}: {
  err: string | null;
  draft: string;
  hasHabits: boolean;
  isListening: boolean;
  listening: boolean;
  canSubmit: boolean;
  onDraftChange: (t: string) => void;
  onDraftSubmit: () => void;
  onClear: () => void;
  onSubmit: () => void;
  onToggleListening: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {err && <div className="text-[11px] text-content-secondary">{err}</div>}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onDraftSubmit();
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Type your habits, or use the mic"
          className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-white px-3 text-[14px] text-content"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="h-11 shrink-0 rounded-xl bg-primary px-4 text-[14px] font-medium text-white disabled:opacity-40"
        >
          Add
        </button>
      </form>
      {VOICE_IN_ENABLED && (
        <button
          type="button"
          onClick={onToggleListening}
          className="h-12 w-full rounded-[14px] text-[16px] font-semibold text-white"
          style={{ background: listening ? '#d83a3a' : '#2447e6' }}
        >
          {listening ? 'Stop' : isListening ? 'Listening...' : 'Speak them instead'}
        </button>
      )}
      {hasHabits && (
        <button
          type="button"
          onClick={onClear}
          className="h-9 w-full rounded-xl border border-border bg-white/70 text-[14px] font-medium text-content-secondary"
        >
          Clear all
        </button>
      )}
      <Button variant="primary" size="lg" fullWidth disabled={!canSubmit} onClick={onSubmit}>
        Continue
      </Button>
    </div>
  );
}

export function BrainDumpCapture(props: BrainDumpCaptureProps) {
  const capture = useBrainDumpCapture(props);
  return (
    <div className="mt-3 flex flex-col gap-4">
      {capture.feed}
      {capture.controls}
    </div>
  );
}
