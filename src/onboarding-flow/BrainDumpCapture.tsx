import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HabitScheduleCard } from '@/components/onboarding/HabitScheduleCard';
import { Button } from '@/components/ui/Button';
import { useVoiceInCapture } from '@/hooks/useVoiceInCapture';
import { VOICE_IN_ENABLED } from '@/lib/config/voice';
import { useAuthStore } from '@/stores/authStore';
import { resolveHabitPolarity } from './curatedHabitPolarity';
import { parseHabitsRegex } from './parseBrainDumpRegex';
import type { BeatCapture, FlowNode } from './types';

type Polarity = 'positive' | 'negative' | null;

interface ParsedHabit {
  name: string;
  days?: number[];
  polarity: Polarity;
  confirmed?: boolean;
}

interface ParseHabitResult {
  name: string;
  days?: number[];
}

interface BrainDumpCaptureProps {
  node: FlowNode;
  onCapture?: (capture: BeatCapture) => void;
  showControls?: boolean;
  enableDevHooks?: boolean;
  onNonBrainDumpText?: (text: string) => void;
}

const PARSE_DEBOUNCE_MS = 450;

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

function hasDays(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((day) => Number.isInteger(day));
}

async function postJSON(
  url: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<{ habits?: ParseHabitResult[] }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error(`parse failed ${response.status}`);
  const data = (await response.json()) as { habits?: unknown };
  const habits: ParseHabitResult[] | undefined = Array.isArray(data.habits)
    ? data.habits.reduce<ParseHabitResult[]>((acc, item) => {
        if (!item || typeof item !== 'object') return acc;
        const parsed = item as { name?: unknown; days?: unknown };
        if (typeof parsed.name !== 'string') return acc;
        const next: ParseHabitResult = { name: parsed.name };
        if (hasDays(parsed.days)) next.days = parsed.days;
        acc.push(next);
        return acc;
      }, [])
    : undefined;
  return { habits };
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
  const [err, setErr] = useState<string | null>(null);
  const [habits, setHabits] = useState<ParsedHabit[]>([]);
  const [parsing, setParsing] = useState(false);

  const sessionIdRef = useRef(createSessionId());
  const dumpRef = useRef('');
  const committedRef = useRef('');
  const parseAbort = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const habitsRef = useRef<Map<string, ParsedHabit>>(new Map());
  const orderRef = useRef<string[]>([]);
  const manualDays = useRef<Map<string, number[]>>(new Map());
  const manualPolarity = useRef<Map<string, Polarity>>(new Map());
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

  const addParsed = useCallback(
    (parsed: ParseHabitResult[], fromAI: boolean, confirm = false) => {
      for (const p of parsed) {
        const name = p.name.trim();
        if (!name) continue;
        if (!fromAI && name.split(/\s+/).length > 4) continue;
        const key = normName(name);
        if (!key) continue;
        if (deletedRef.current.has(key)) continue;
        const existing = habitsRef.current.get(key);
        habitsRef.current.set(key, {
          name: fromAI ? name : (existing?.name ?? name),
          days: p.days ?? existing?.days,
          polarity: resolveHabitPolarity(name).polarity,
          confirmed: existing?.confirmed || (fromAI && confirm),
        });
        if (!orderRef.current.includes(key)) orderRef.current.push(key);
      }

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
      const timeout = setTimeout(() => ac.abort(), 8000);
      setParsing(true);
      try {
        const screenId = node.screenId || 'ONBOARD-ADVANCED';
        const body = {
          text: full,
          session_id: sessionIdRef.current,
          screen_id: screenId,
          anon_id: useAuthStore.getState().anonId ?? undefined,
        };
        let parsed: { habits?: ParseHabitResult[] };
        try {
          parsed = await postJSON('/api/llm/parse-brain-dump', body, ac.signal);
        } catch (realEndpointError) {
          if (ac.signal.aborted) throw realEndpointError;
          parsed = await postJSON('/api/sim-parse-habits', { text: full }, ac.signal);
        }
        if (Array.isArray(parsed.habits)) addParsed(parsed.habits, true, confirm);
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
    [addParsed, node.screenId],
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
    // TODO: Wire persistence through api/_lib/llm/onboarding/handlers/submitBrainDump.ts
    // and dataService.createHabit in the next slice.
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
      hasHabits={habits.length > 0 || transcript.length > 0}
      isListening={isListening}
      listening={listening}
      canSubmit={canSubmit}
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
  habits: ParsedHabit[];
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
  hasHabits,
  isListening,
  listening,
  canSubmit,
  onClear,
  onSubmit,
  onToggleListening,
}: {
  err: string | null;
  hasHabits: boolean;
  isListening: boolean;
  listening: boolean;
  canSubmit: boolean;
  onClear: () => void;
  onSubmit: () => void;
  onToggleListening: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {(err || !VOICE_IN_ENABLED) && (
        <div className="text-[11px] text-content-secondary">
          {!VOICE_IN_ENABLED && 'voice-in disabled (set VITE_STATE3_ENABLED=true)'}
          {err && `  -  ${err}`}
        </div>
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
      <button
        type="button"
        onClick={onToggleListening}
        className="h-12 w-full rounded-[14px] bg-primary text-[16px] font-semibold text-white"
        style={{ background: listening ? '#d83a3a' : '#2447e6' }}
      >
        {listening ? 'Stop' : isListening ? 'Listening...' : 'Listen (Soniox)'}
      </button>
      <Button variant="primary" size="lg" fullWidth disabled={!canSubmit} onClick={onSubmit}>
        Continue
      </Button>
    </div>
  );
}

export function BrainDumpCapture(props: BrainDumpCaptureProps) {
  const enableDevHooks =
    props.enableDevHooks ??
    (typeof window !== 'undefined' && window.location.pathname.includes('onboarding-flow-sim'));
  const capture = useBrainDumpCapture({ ...props, enableDevHooks });
  return (
    <div className="mt-3 flex flex-col gap-4">
      {capture.feed}
      {capture.controls}
    </div>
  );
}
