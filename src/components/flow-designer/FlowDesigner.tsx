import { Icon } from '@iconify/react';
import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Orb } from '@/components/orb/Orb';
import { orbSpeaking } from '@/components/orb/orbView';
import {
  AnimationsCtx,
  PlayingCtx,
  RevealCtx,
  SpokenWordsCtx,
  StepRevealCtx,
  type BeatDef,
} from './beatKit';
import { kindOf, raf, runBeatNarration, runBeatScript, sample, stopSpeech } from './beatNarration';
import { BEAT_DEFS } from './beats';
import { COACH_BG } from './beats/_beatStyle';
import {
  BEATS_SOURCE,
  BEAT_BY_SCREEN_ID,
  BEAT_BY_ID,
  resolveBeatStructure,
  type BeatEntry,
  type ScriptLine,
  type BibleSections,
  type BeatIO,
  type BeatDatum,
} from './beatsSource';
import {
  IMPROVISATION,
  GLOBAL_RULES,
  TOOL_FAILURE,
  CONVERSATION_MODEL,
  DATA_PASSING,
  COACH_IDENTITY,
  CONSUMER_CONTRACT,
  ENFORCER_REGISTRY,
  RETIRED_ENFORCER_IDS,
  CANONICAL_ENUMS,
  OPEN_DECISIONS,
  FILES_SYNC_MAP,
  type FileMapRow,
} from './flowBible';
import { FlowStateCtx, type FlowState, type HabitScheduleCfg } from './flowStateCtx';

/**
 * FlowDesigner -- the chat-native onboarding flow as one continuous scroll,
 * built from the REAL flow-builder beat components (the same ones FlowBuilder
 * renders in its live Play pane), in the v3 order with v3 content.
 *
 * Each beat is the real registry component (BEAT_DEFS, keyed by type). To let
 * them all render stacked in one scroll without a single global "active beat"
 * assumption, every beat is wrapped in its OWN isolated flow-state provider
 * (IsolatedBeat below), mirroring how FlowBuilder mounts a single beat preview,
 * just once per beat down the page.
 *
 * Voice tags sit OUTSIDE the phone frame in the LEFT margin (coach bubbles are
 * left-aligned), each tag next to the beat it describes. A tag is engine + mode:
 *   MP3 . Verbatim        pre-recorded clip (blue)
 *   Cartesia . Verbatim   live TTS reading a scripted opener (purple)
 *   Cartesia . Improvise  live TTS phrasing it itself (purple)
 *   Vapi . Improvise      live two-way coaching (green)
 *   Silent                no coach voice at this beat (gray)
 */

// Layout constants. The page is laid out as per-beat rows of
// [source-of-truth rail | phone column], so each beat carries its own full
// context beside the rendered screen.
const TAG_COL_W = 320; // fixed-width left column holding the source-of-truth rail
const TAG_GAP = 14; // space between the tag and the phone's left edge
const PHONE_W = 420; // the phone interior width
const WORDS_COL_W = 300; // fixed-width right column holding the original words card
const WORDS_GAP = 20; // space between the phone's right edge and the words card
const TOTAL_W = TAG_COL_W + TAG_GAP + PHONE_W; // width before the right words column

// The real beat registry, keyed by type. BEAT_DEFS auto-collects every beat
// file (the same set the flow builder uses). REGISTRY_MAP[type].Comp is the
// real component for that beat.
const REGISTRY_MAP: Record<string, BeatDef> = Object.fromEntries(BEAT_DEFS.map((d) => [d.type, d]));

// --- Onboarding copy, derived from the ONE source (beatsSource.ts) ---
// The annotated view and the rendered beat components read their coach copy from
// each beat's script[]. There is no second metadata store: these helpers pull the
// opener, the coach bubbles, and a named component element's line straight off the
// script, keyed by screenId, so the words the component shows are the words the
// engine speaks.
const ENTRY_BY_SCREEN_ID = BEAT_BY_SCREEN_ID;

function entryFor(screenId?: string): BeatEntry | undefined {
  return screenId ? ENTRY_BY_SCREEN_ID[screenId] : undefined;
}

// The opening coach line: the script line bound to opener/opener-line, else the
// first coach bubble with words.
function scriptOpener(entry?: BeatEntry): string {
  const s = entry?.script ?? [];
  const op = s.find((l) => l.bindsTo.element === 'opener' || l.bindsTo.element === 'opener-line');
  if (op?.words) return op.words;
  return s.find((l) => l.bindsTo.kind === 'bubble' && l.words)?.words ?? '';
}

// Every coach bubble line, in seq order (opener + bubble-N).
function scriptBubbles(entry?: BeatEntry): string[] {
  return (entry?.script ?? [])
    .filter((l) => l.bindsTo.kind === 'bubble' && l.words)
    .map((l) => l.words);
}

// A named component element's spoken line (e.g. age, gender).
function scriptElementLine(entry: BeatEntry | undefined, elementId: string): string {
  return (
    (entry?.script ?? []).find(
      (l) => l.bindsTo.kind === 'component' && l.bindsTo.element === elementId,
    )?.words ?? ''
  );
}

// The coach-copy props each beat component needs, derived from script[]. Merged
// into the beat's props so the rendered component shows the same words the engine
// speaks.
function metadataPropsForBeat(type: string, screenId?: string): Record<string, string> {
  const entry = entryFor(screenId);
  if (!entry) return {};
  const opener = scriptOpener(entry);
  const bubbles = scriptBubbles(entry);

  switch (type) {
    case 'profile-beat':
      return {
        greeting: opener,
        askAge: scriptElementLine(entry, 'age'),
        askGender: scriptElementLine(entry, 'gender'),
      };
    case 'advanced-capture':
      return { coachLine: opener, closeCoachLine: bubbles[1] ?? '' };
    case 'advanced-frequency':
      return {
        coachLine: opener,
        coachLine2: bubbles[1] ?? '',
        confirmCoachLine: bubbles[bubbles.length - 1] ?? '',
      };
    case 'into-app':
      return {
        coachLine: opener,
        buttonLabel: entry.props?.buttonLabel ?? 'Approve and start',
        buttonEditLabel: entry.props?.buttonEditLabel ?? 'I want to change something',
      };
    case 'state-check':
    case 'morning-checkin-setup':
    case 'reflection-card':
    case 'habit-schedule':
      return { coachLine: opener, coachLine2: bubbles[1] ?? '' };
    case 'mic-permission':
    case 'path-selection':
    case 'category-grid':
    case 'goals-list':
    case 'habit-picker':
    case 'custom-entry':
    case 'weekly-projection':
      return { coachLine: opener };
    default:
      return {};
  }
}

// --- Isolated per-beat flow-state provider ---
// A fresh, scoped FlowState for one beat, so beats can stack in one scroll
// without sharing a global active-beat state. Mirrors the flowState object
// FlowBuilder builds for its Play pane (flowStateCtx.ts shape), seeded with
// light demo values so each beat looks interactive on its own. An optional seed
// overrides the picked category / goals so a beat that carries that selection
// (the goals-list and habit-picker variants) renders the right on-screen grid,
// not the fixed demo default. Beats without the seed keep the demo values.
function useIsolatedFlowState(seed?: { category?: string; goals?: string[] }): FlowState {
  const [path, setPath] = useState<'new' | 'exp' | null>('new');
  const [category, setCategoryState] = useState<string | null>(seed?.category ?? 'Sleep better');
  const [goals, setGoals] = useState<string[]>(seed?.goals ?? ['Fall asleep earlier']);
  const [habits, setHabits] = useState<string[]>(['No screens after 10 PM']);
  // 24-hour "HH:MM" so the beats' formatTime12() renders them correctly.
  const [morningTime, setMorningTime] = useState<string | null>('08:00');
  const [eveningTime, setEveningTime] = useState<string | null>('21:30');
  const [habitConfigs, setHabitConfigsState] = useState<Record<string, HabitScheduleCfg>>({});
  const [tourHabitStatus, setTourHabitStatusState] = useState<
    Record<string, 'done' | 'missed' | 'none'>
  >({});
  const [tourSelectedDate, setTourSelectedDateState] = useState<string | null>(null);
  const toggleIn = (v: string, max: number, set: (fn: (p: string[]) => string[]) => void) =>
    set((p) => (p.includes(v) ? p.filter((x) => x !== v) : p.length < max ? [...p, v] : p));
  return {
    path,
    category,
    goals,
    habits,
    setPath,
    setCategory: (v) => {
      setCategoryState(v);
      setGoals([]);
      setHabits([]);
    },
    toggleGoal: (v, max = 2) => toggleIn(v, max, setGoals),
    toggleHabit: (v, max = 2) => toggleIn(v, max, setHabits),
    setHabits: (v) => setHabits(v),
    morningTime,
    eveningTime,
    habitConfigs,
    setMorningTime: (v) => setMorningTime(v),
    setEveningTime: (v) => setEveningTime(v),
    setHabitConfig: (habit, cfg) => setHabitConfigsState((p) => ({ ...p, [habit]: cfg })),
    tourHabitStatus,
    tourSelectedDate,
    setTourHabitStatus: (next) => setTourHabitStatusState(next),
    setTourSelectedDate: (v) => setTourSelectedDateState(v),
  };
}

// Mounts one real beat component inside its own scoped providers. PlayingCtx is
// true so beats hold their fully revealed state (no looping). AnimationsCtx is
// false so the whole flow renders settled (a debug view, not an animation).

// The demo user name the coach greets with. Beats carry {name} in their copy
// (the real flow substitutes the sign-up name); we substitute it here too so
// the greeting reads as a real name, not the literal token.
const DEMO_NAME = 'Yair';

function applyName(props?: Record<string, string>): Record<string, string> | undefined {
  if (!props) return props;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    out[k] = typeof v === 'string' && v.includes('{name}') ? v.split('{name}').join(DEMO_NAME) : v;
  }
  return out;
}

// Inline coach-bubble fallback: renders a single AI speech bubble using the
// same styling BeatPlayer applies to coach steps (white bubble, left-aligned,
// soft shadow). Used for beat types that are not in BEAT_DEFS (e.g. coach-bubble
// from FlowBuilder's inline REGISTRY). Props: `text`.
function CoachBubbleFallback({ text }: { text?: string }) {
  const line = text ?? 'What feels most worth improving right now?';
  return (
    <div
      style={{
        maxWidth: '85%',
        alignSelf: 'flex-start',
        borderRadius: '16px 16px 16px 4px',
        background: '#fff',
        padding: '10px 16px',
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.45,
        color: '#0f172a',
        boxShadow: '0px 4px 16px -4px rgba(15,23,42,0.12)',
        fontFamily: 'Urbanist, -apple-system, sans-serif',
      }}
    >
      {line}
    </div>
  );
}

// Mounts one real beat component inside its own scoped providers. In the stacked
// annotated view it renders settled (animated=false). The Play view reuses the
// exact same mount with animated=true and drives the reveal off the spoken line
// via stepReveal (BeatPlayer steps) and elementReveal (per-element bloom). Both
// default to null so the stacked view is unchanged.
export function IsolatedBeat({
  type,
  props,
  animated = false,
  stepReveal = null,
  elementReveal = null,
}: {
  type: string;
  props?: Record<string, string>;
  animated?: boolean;
  stepReveal?: number | null;
  elementReveal?: number | null;
}) {
  // Seed the picked selection from the beat's props so a variation renders its
  // own on-screen grid: goals-list shows the picked category's subcategories,
  // habit-picker shows the picked goal's habits. Only these variants carry
  // category / goal props, so every other beat keeps the demo defaults.
  const flowState = useIsolatedFlowState({
    category: props?.category,
    goals: props?.goal ? [props.goal] : undefined,
  });

  // coach-bubble is defined inline in FlowBuilder, not in BEAT_DEFS. Handle it
  // directly so check-in greeting and wrap lines render as real speech bubbles
  // rather than the "Unknown beat type" placeholder.
  if (type === 'coach-bubble') {
    return <CoachBubbleFallback text={applyName(props)?.text} />;
  }

  const entry = REGISTRY_MAP[type];
  if (!entry) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-secondary px-4 py-3 text-[13px] text-content-tertiary">
        Unknown beat type: {type}
      </div>
    );
  }
  return (
    <PlayingCtx.Provider value={animated}>
      <AnimationsCtx.Provider value={animated}>
        <StepRevealCtx.Provider value={stepReveal}>
          <RevealCtx.Provider value={elementReveal}>
            <FlowStateCtx.Provider value={flowState}>
              <div className="overflow-hidden [transform:translateZ(0)]">
                {createElement(entry.Comp, applyName(props))}
              </div>
            </FlowStateCtx.Provider>
          </RevealCtx.Provider>
        </StepRevealCtx.Provider>
      </AnimationsCtx.Provider>
    </PlayingCtx.Provider>
  );
}

// --- Voice engine + mode tags ---

type VoiceEngine = 'MP3' | 'Cartesia' | 'Vapi' | 'Silent';
type VoiceMode = 'Verbatim' | 'Improvise' | null;

const ENGINE_STYLE: Record<
  VoiceEngine,
  { bg: string; text: string; border: string; icon: string }
> = {
  MP3: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd', icon: 'mdi:play-circle-outline' },
  Cartesia: { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd', icon: 'mdi:waveform' },
  Vapi: { bg: '#dcfce7', text: '#15803d', border: '#86efac', icon: 'mdi:microphone-outline' },
  Silent: { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1', icon: 'mdi:volume-off' },
};

function tagLabel(engine: VoiceEngine, mode: VoiceMode): string {
  return mode ? `${engine} · ${mode}` : engine;
}

function VoiceTag({ engine, mode }: { engine: VoiceEngine; mode: VoiceMode }) {
  const s = ENGINE_STYLE[engine];
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 99,
        border: `1.5px solid ${s.border}`,
        background: s.bg,
        color: s.text,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon icon={s.icon} style={{ width: 12, height: 12 }} />
      {tagLabel(engine, mode)}
    </div>
  );
}

// --- Path banner (BEGINNER / ADVANCED / BOTH PATHS) ---
// A prominent, full-width colored bar rendered above each onboarding beat row
// so it's obvious at a glance which path a beat belongs to.

const PATH_STYLE: Record<BeatPath, { bg: string; text: string; label: string }> = {
  beginner: { bg: '#16a34a', text: '#ffffff', label: 'BEGINNER' },
  advanced: { bg: '#d97706', text: '#ffffff', label: 'ADVANCED' },
  both: { bg: '#475569', text: '#ffffff', label: 'BOTH PATHS' },
};

function PathBanner({ path, edge }: { path?: BeatPath; edge: 'start' | 'end' }) {
  // A marker only at the START and END of a branched section, not on every beat.
  if (!path || path === 'both') return null;
  const s = PATH_STYLE[path];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: s.bg,
        color: s.text,
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '8px 12px',
        borderRadius: 8,
        marginLeft: TAG_COL_W + TAG_GAP,
        marginBottom: edge === 'start' ? 10 : 0,
        marginTop: edge === 'end' ? 10 : 0,
        width: PHONE_W - 1,
        fontFamily: 'Urbanist, -apple-system, sans-serif',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }}
    >
      {s.label} PATH {edge === 'start' ? 'STARTS' : 'ENDS'}
    </div>
  );
}

// A thin divider plus the beat number, name, engine chip, and play control above
// each beat. The play control AND the engine/MP3 chip live here, OUTSIDE the
// rendered phone, so the phone's Coach header stays a clean mirror of the real
// app screen (just "Coach", no annotation chrome).
function BeatHeader({
  n,
  beat,
  playing,
  onTogglePlay,
}: {
  n: number;
  beat: FlowBeat;
  playing: boolean;
  onTogglePlay: () => void;
}) {
  const chip = ENGINE_STYLE[beat.engine];
  return (
    <div style={{ marginTop: 28, marginBottom: 10 }}>
      <div style={{ height: 1, background: '#cbd5e1', width: '100%' }} />
      <div
        style={{
          marginTop: 6,
          marginLeft: TAG_COL_W + TAG_GAP,
          width: PHONE_W,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          fontFamily: 'Urbanist, -apple-system, sans-serif',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#64748b',
            }}
          >
            Beat {n}
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 14,
              fontWeight: 800,
              color: '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {beat.name}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {beat.engine && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: chip?.text ?? '#6366f1',
                background: chip?.bg ?? 'rgba(99,102,241,0.1)',
                border: `1px solid ${chip?.border ?? 'transparent'}`,
                padding: '3px 9px',
                borderRadius: 999,
              }}
            >
              {beat.engine}
            </span>
          )}
          <button
            type="button"
            onClick={onTogglePlay}
            title={playing ? 'Stop' : 'Play this beat'}
            aria-label={playing ? 'Stop this beat' : 'Play this beat'}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: playing ? '#ef4444' : '#135BEB',
              boxShadow: '0 8px 18px -12px rgba(15,23,42,0.55)',
            }}
          >
            <Icon
              icon={playing ? 'mdi:stop' : 'mdi:play'}
              width={17}
              height={17}
              style={{ color: '#fff' }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Legend ---

const LEGEND: { engine: VoiceEngine; mode: VoiceMode; note: string }[] = [
  { engine: 'MP3', mode: 'Verbatim', note: 'Pre-recorded clip' },
  { engine: 'Cartesia', mode: 'Verbatim', note: 'Live TTS, scripted opener' },
  { engine: 'Cartesia', mode: 'Improvise', note: 'Live TTS, phrased on the fly' },
  { engine: 'Vapi', mode: 'Improvise', note: 'Live two-way coaching' },
  { engine: 'Silent', mode: null, note: 'No coach voice' },
];

function VoiceLegend() {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '12px 14px',
        marginBottom: 24,
        maxWidth: 720,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        fontFamily: 'Urbanist, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#475569',
          marginBottom: 8,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        Voice delivery
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {LEGEND.map((l) => (
          <div
            key={`${l.engine}-${l.mode ?? 'none'}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <VoiceTag engine={l.engine} mode={l.mode} />
            <span style={{ fontSize: 11, color: '#64748b' }}>{l.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Source-of-truth rail (left column) ---
// Read-only card showing the beat context, verbatim copy, narration segments,
// clip hooks, and the resolved props the component actually reads.

function WordsFlagChip({ label, tone }: { label: string; tone: 'engine' | 'live' | 'note' }) {
  const styles: Record<typeof tone, { bg: string; text: string; border: string }> = {
    engine: { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
    live: { bg: '#fef9c3', text: '#854d0e', border: '#fde68a' },
    note: { bg: '#f8fafc', text: '#94a3b8', border: '#e2e8f0' },
  };
  const s = styles[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 99,
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.text,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function ContextSection({
  title,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  // Optional inline marker next to the title (e.g. a status chip). Additive,
  // existing string-only callers are unaffected.
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
      <summary
        style={{
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 800,
          color: '#475569',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>{title}</span>
        {badge}
      </summary>
      <div style={{ marginTop: 8 }}>{children}</div>
    </details>
  );
}

function ContextKeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#94a3b8',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.45, color: '#334155' }}>{value}</div>
    </div>
  );
}

// --- Bible panel: the 12-section per-beat contract as accordion panels ---
// Rendered inside SourceOfTruthPanel when the beat carries a `bible` fill. Script
// stays in the right column (ScriptPanel); here the other sections live. A
// one-line rules summary stays open; every full section collapses. Enforcers show
// as small mono tags; COPY-PENDING values get a distinct pill; rules are rows.

function MonoTag({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 6px',
        borderRadius: 5,
        border: '1px solid #dbe2ea',
        background: '#f1f5f9',
        color: '#475569',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 10,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function PendingPill() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 7px',
        borderRadius: 99,
        border: '1px solid #fcd34d',
        background: '#fffbeb',
        color: '#b45309',
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      copy-pending
    </span>
  );
}

// Amber for anything still in flight, green once built/verified. Covers both
// SourceStatus (bible sections) and EnforcerStatus (registry rows).
const GREEN_STATUSES = new Set(['built', 'verified']);

function StatusChip({ status, label }: { status: string; label?: string }) {
  const green = GREEN_STATUSES.has(status);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 7px',
        borderRadius: 99,
        border: `1px solid ${green ? '#86efac' : '#fcd34d'}`,
        background: green ? '#dcfce7' : '#fffbeb',
        color: green ? '#15803d' : '#b45309',
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {label ?? status}
    </span>
  );
}

function EnforcerRow({ enforcedBy }: { enforcedBy: readonly string[] }) {
  if (!enforcedBy.length) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 5,
        alignItems: 'center',
        marginTop: 4,
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          color: '#94a3b8',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        Enforced by
      </span>
      {enforcedBy.map((t) => (
        <MonoTag key={t} label={t} />
      ))}
    </div>
  );
}

function BibleKVList({
  rows,
}: {
  rows: readonly { label: string; value: string; pending?: boolean }[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#94a3b8',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {r.label}
            </span>
            {r.pending && <PendingPill />}
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.45, color: '#334155' }}>{r.value}</div>
        </div>
      ))}
    </div>
  );
}

function WatchOut({ text }: { text: string }) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: '7px 10px',
        borderRadius: 8,
        background: '#fff7ed',
        border: '1px solid #fed7aa',
        fontSize: 11,
        lineHeight: 1.45,
        color: '#9a3412',
      }}
    >
      <span style={{ fontWeight: 800 }}>Watch-out: </span>
      {text}
    </div>
  );
}

interface RuleLike {
  readonly id: string;
  readonly rule: string;
  readonly severity: 'must' | 'should';
  readonly enforcedBy: readonly string[];
  readonly status?: string;
}

function RuleRows({ rules }: { rules: readonly RuleLike[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rules.map((r) => (
        <div
          key={r.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            padding: '7px 9px',
            borderRadius: 8,
            background: '#f8fafc',
            border: '1px solid #eef2f7',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 10.5,
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              {r.id}
            </span>
            <span
              style={{
                padding: '0px 6px',
                borderRadius: 99,
                fontSize: 9.5,
                fontWeight: 800,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                border: r.severity === 'must' ? '1px solid #fca5a5' : '1px solid #c7d2fe',
                background: r.severity === 'must' ? '#fef2f2' : '#eef2ff',
                color: r.severity === 'must' ? '#b91c1c' : '#4338ca',
              }}
            >
              {r.severity}
            </span>
            {r.status && <StatusChip status={r.status} />}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.45, color: '#334155' }}>{r.rule}</div>
          <EnforcerRow enforcedBy={r.enforcedBy} />
        </div>
      ))}
    </div>
  );
}

// --- Data in / out (beat.io, flowBible DATA_PASSING) ---
// Compact tables, not the full watchOut-style card: one row per BeatDatum.

const FIELD_LABEL: Record<'from' | 'writtenBy' | 'persistsTo', string> = {
  from: 'from',
  writtenBy: 'writtenBy',
  persistsTo: 'persistsTo',
};

function IOTable({
  title,
  rows,
  fields,
}: {
  title: string;
  rows: readonly BeatDatum[];
  fields: readonly ('from' | 'writtenBy' | 'persistsTo')[];
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#94a3b8',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      {rows.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((d, i) => (
            <div
              key={`${d.key}-${i}`}
              style={{
                padding: '6px 8px',
                borderRadius: 7,
                background: '#f8fafc',
                border: '1px solid #eef2f7',
                fontSize: 11.5,
                lineHeight: 1.4,
              }}
            >
              <MonoTag label={d.key} />
              {fields.map((f) =>
                f === 'from' ? (
                  <div key={f} style={{ marginTop: 2, color: '#334155' }}>
                    <span style={{ color: '#94a3b8', fontWeight: 700 }}>{FIELD_LABEL[f]}: </span>
                    {d.from}
                  </div>
                ) : d[f] ? (
                  <div key={f} style={{ marginTop: 2, color: '#334155' }}>
                    <span style={{ color: '#94a3b8', fontWeight: 700 }}>{FIELD_LABEL[f]}: </span>
                    {d[f]}
                  </div>
                ) : null,
              )}
              {d.note && (
                <div style={{ marginTop: 2, color: '#64748b', fontStyle: 'italic' }}>{d.note}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: '#cbd5e1' }}>none</div>
      )}
    </div>
  );
}

function IOBlock({ io, inheritedFrom }: { io?: BeatIO; inheritedFrom?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {inheritedFrom && (
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#4338ca' }}>
          (inherited from {inheritedFrom})
        </div>
      )}
      <IOTable title="Data in" rows={io?.dataIn ?? []} fields={['from', 'writtenBy']} />
      <IOTable title="Data out" rows={io?.dataOut ?? []} fields={['persistsTo', 'writtenBy']} />
    </div>
  );
}

// Sub-beat marker: shown on the card when a beat inherits from a head beat
// (Yair 2026-07-09: beat + sub-beat inheritance, no copying across variants).
function VariantChip({ head }: { head: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 8px',
        borderRadius: 99,
        border: '1px solid #c7d2fe',
        background: '#eef2ff',
        color: '#4338ca',
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      inherits from {head}
    </span>
  );
}

function BiblePanel({
  beat,
  bible,
  io,
  variantOf,
  inheritedFrom,
}: {
  beat: FlowBeat;
  bible: BibleSections;
  io?: BeatIO;
  variantOf?: string;
  inheritedFrom?: string;
}) {
  const rulesContext = bible.rulesContext ?? [];
  const rulesCode = bible.rulesCode ?? [];
  const mustCount =
    rulesContext.filter((r) => r.severity === 'must').length +
    rulesCode.filter((r) => r.severity === 'must').length;
  const shouldCount =
    rulesContext.filter((r) => r.severity === 'should').length +
    rulesCode.filter((r) => r.severity === 'should').length;

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Card header: the beat's name + type ARE the header. Identity (section 1)
          sits directly below and carries beatId/order/path/screenId/route, so the
          old separate metadata panel above this card is redundant and removed. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          justifyContent: 'space-between',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            {beat.name}
            {variantOf && <VariantChip head={variantOf} />}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {beat.type}
            {beat.path ? ` · ${PATH_STYLE[beat.path].label}` : ''}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 4,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: '#135bec',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Bible fill · 12 sections
          </span>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              padding: '1px 7px',
              borderRadius: 99,
              background: '#eaf1ff',
              color: '#135bec',
              border: '1px solid #c7d8ff',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            full contract
          </span>
        </div>
      </div>

      {/* One-line rules summary, default open */}
      <details open style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
        <summary
          style={{
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 800,
            color: '#475569',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Rules summary
        </summary>
        <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.5, color: '#334155' }}>
          {mustCount} must · {shouldCount} should — every rule names a real enforcer.{' '}
          {rulesContext.length} coach-behavior evals + {rulesCode.length} engine invariants. Nothing
          prose-only.
        </div>
      </details>

      {/* 1. Identity */}
      {bible.identity && (
        <ContextSection title="1 · Identity + aliases">
          <BibleKVList rows={bible.identity.rows} />
          <div style={{ marginTop: 10 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#94a3b8',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Alias contract
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {bible.identity.aliases.map((a) => (
                <div
                  key={a.surface}
                  style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12 }}
                >
                  <span style={{ color: '#64748b', minWidth: 120, flexShrink: 0 }}>
                    {a.surface}
                  </span>
                  <MonoTag label={a.value} />
                </div>
              ))}
            </div>
          </div>
          {bible.identity.watchOut && <WatchOut text={bible.identity.watchOut} />}
          <EnforcerRow enforcedBy={bible.identity.enforcedBy} />
        </ContextSection>
      )}

      {/* 2. Script timing (per-line reveal + timing) */}
      {bible.scriptMeta && (
        <ContextSection title="2 · Script reveal + timing">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bible.scriptMeta.rows.map((m) => (
              <div
                key={m.seq}
                style={{
                  padding: '7px 9px',
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #eef2f7',
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: '#334155',
                }}
              >
                <span style={{ fontWeight: 800, color: '#c7d2e0' }}>seq {m.seq}</span>
                <div style={{ marginTop: 2 }}>
                  <span style={{ fontWeight: 700, color: '#94a3b8' }}>reveal: </span>
                  {m.reveal}
                </div>
                <div>
                  <span style={{ fontWeight: 700, color: '#94a3b8' }}>timing: </span>
                  {m.timing}
                </div>
              </div>
            ))}
          </div>
          <EnforcerRow enforcedBy={bible.scriptMeta.enforcedBy} />
        </ContextSection>
      )}

      {/* 3. Components */}
      {bible.components && (
        <ContextSection title="3 · Components">
          <BibleKVList rows={bible.components.rows} />
          {bible.components.watchOut && <WatchOut text={bible.components.watchOut} />}
          <EnforcerRow enforcedBy={bible.components.enforcedBy} />
        </ContextSection>
      )}

      {/* 4. Voice */}
      {bible.voice && (
        <ContextSection title="4 · Voice">
          <BibleKVList rows={bible.voice.rows} />
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {bible.voice.perLine.map((v) => (
              <div
                key={v.seq}
                style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12 }}
              >
                <span style={{ fontWeight: 800, color: '#c7d2e0', minWidth: 44 }}>seq {v.seq}</span>
                <span style={{ color: '#334155', flex: 1 }}>{v.resolvesTo}</span>
                <MonoTag label={`live: ${v.liveAllowed}`} />
              </div>
            ))}
          </div>
          {bible.voice.assertion && (
            <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.45, color: '#64748b' }}>
              {bible.voice.assertion}
            </div>
          )}
          <EnforcerRow enforcedBy={bible.voice.enforcedBy} />
        </ContextSection>
      )}

      {/* 5. Rules · coach behavior */}
      {rulesContext.length > 0 && (
        <ContextSection title={`5 · Rules · coach behavior (${rulesContext.length})`}>
          <RuleRows rules={rulesContext} />
        </ContextSection>
      )}

      {/* 6. Rules · engine invariants */}
      {rulesCode.length > 0 && (
        <ContextSection title={`6 · Rules · engine invariants (${rulesCode.length})`}>
          <RuleRows rules={rulesCode} />
        </ContextSection>
      )}

      {/* 7. Context (coach prose) */}
      {bible.contextProse && (
        <ContextSection title="7 · Context (coach prose)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            {bible.contextProse.pending && <PendingPill />}
          </div>
          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.55,
              color: '#334155',
              fontStyle: 'italic',
              borderLeft: '3px solid #e2e8f0',
              paddingLeft: 10,
            }}
          >
            {bible.contextProse.prose}
          </div>
          <EnforcerRow enforcedBy={bible.contextProse.enforcedBy} />
        </ContextSection>
      )}

      {/* 8. Allowed tools */}
      {bible.allowedTools && (
        <ContextSection title="8 · Allowed tools">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {bible.allowedTools.tools.map((t) => (
              <MonoTag key={t} label={t} />
            ))}
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#64748b', marginBottom: 8 }}>
            {bible.allowedTools.callRules}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bible.allowedTools.specs.map((s) => (
              <div
                key={s.tool}
                style={{
                  padding: '7px 9px',
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #eef2f7',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <MonoTag label={s.tool} />
                  {s.pending && <PendingPill />}
                </div>
                <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#334155', marginTop: 4 }}>
                  <span style={{ fontWeight: 700, color: '#94a3b8' }}>args: </span>
                  {s.args}
                </div>
                <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#334155' }}>
                  <span style={{ fontWeight: 700, color: '#94a3b8' }}>when: </span>
                  {s.when}
                </div>
              </div>
            ))}
          </div>
          {bible.allowedTools.note && (
            <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.45, color: '#64748b' }}>
              {bible.allowedTools.note}
            </div>
          )}
          <EnforcerRow enforcedBy={bible.allowedTools.enforcedBy} />
        </ContextSection>
      )}

      {/* 9. Persistence */}
      {bible.persistence && (
        <ContextSection title="9 · Persistence">
          <BibleKVList rows={bible.persistence.rows} />
          {bible.persistence.watchOut && <WatchOut text={bible.persistence.watchOut} />}
          <EnforcerRow enforcedBy={bible.persistence.enforcedBy} />
        </ContextSection>
      )}

      {/* 10. Flow */}
      {bible.flow && (
        <ContextSection title="10 · Flow (advance + branch)">
          <BibleKVList rows={bible.flow.rows} />
          <EnforcerRow enforcedBy={bible.flow.enforcedBy} />
        </ContextSection>
      )}

      {/* 11. Edges */}
      {bible.edges && (
        <ContextSection title={`11 · Edges (${bible.edges.rows.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {bible.edges.rows.map((e) => (
              <div key={e.edge} style={{ fontSize: 12, lineHeight: 1.45 }}>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{e.edge}: </span>
                <span style={{ color: '#334155' }}>{e.behavior}</span>
              </div>
            ))}
          </div>
          <EnforcerRow enforcedBy={bible.edges.enforcedBy} />
        </ContextSection>
      )}

      {/* 12. Acceptance */}
      {bible.acceptance && (
        <ContextSection title={`12 · Acceptance (${bible.acceptance.rows.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bible.acceptance.rows.map((a) => (
              <div key={a.criterion} style={{ fontSize: 12, lineHeight: 1.45 }}>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{a.criterion}</div>
                <div style={{ color: '#334155' }}>{a.check}</div>
              </div>
            ))}
          </div>
          <EnforcerRow enforcedBy={bible.acceptance.enforcedBy} />
        </ContextSection>
      )}

      {/* 13. Multi-turn conversation (Yair 2026-07-09: own section, not a section-5 sub-block) */}
      {bible.conversation && (
        <ContextSection title="13 · Multi-turn conversation">
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: '#334155', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: '#94a3b8' }}>opens: </span>
            {bible.conversation.opens}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {bible.conversation.branches.map((b, i) => (
              <div
                key={i}
                style={{
                  padding: '7px 9px',
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #eef2f7',
                  fontSize: 12,
                  lineHeight: 1.45,
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, color: '#94a3b8' }}>on: </span>
                  {b.on}
                </div>
                <div>
                  <span style={{ fontWeight: 700, color: '#94a3b8' }}>reply: </span>
                  {b.reply}
                </div>
                <div style={{ marginTop: 2 }}>
                  <span style={{ fontWeight: 700, color: '#94a3b8' }}>then: </span>
                  <MonoTag label={b.then} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.45, color: '#64748b' }}>
            maxTurns {bible.conversation.maxTurns} · onMaxTurns: {bible.conversation.onMaxTurns}
          </div>
        </ContextSection>
      )}

      {/* Data in / out (beat.io, top-level; resolved through variantOf inheritance) */}
      <ContextSection title="Data in / out">
        <IOBlock io={io} inheritedFrom={inheritedFrom} />
      </ContextSection>

      {/* Applicable decisions (14th key, unnumbered) */}
      {bible.applicableDecisions && (
        <ContextSection title="Applicable decisions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bible.applicableDecisions.rows.map((d) => (
              <div
                key={d.decision}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  padding: '7px 9px',
                  borderRadius: 8,
                  background: d.binds ? '#f0fdf4' : '#f8fafc',
                  border: `1px solid ${d.binds ? '#bbf7d0' : '#eef2f7'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      padding: '0px 6px',
                      borderRadius: 99,
                      fontSize: 9.5,
                      fontWeight: 800,
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                      border: d.binds ? '1px solid #86efac' : '1px solid #cbd5e1',
                      background: d.binds ? '#dcfce7' : '#f1f5f9',
                      color: d.binds ? '#15803d' : '#64748b',
                    }}
                  >
                    {d.binds ? 'binds' : 'none'}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                    {d.decision}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#334155' }}>{d.how}</div>
              </div>
            ))}
          </div>
          <EnforcerRow enforcedBy={bible.applicableDecisions.enforcedBy} />
        </ContextSection>
      )}
    </div>
  );
}

function SourceOfTruthPanel({ beat }: { beat: FlowBeat }) {
  const entry = beat.screenId ? ENTRY_BY_SCREEN_ID[beat.screenId] : undefined;
  // The one-source entry keyed by beatId (not screenId: category and
  // category-women SHARE a screenId, so a screenId lookup would collide).
  // io/bible/variantOf all live here.
  const entryFull = BEAT_BY_ID[beat.id];
  const resolved = resolveBeatStructure(beat.id);

  // When the beat carries a Bible fill, the Bible card IS the single card. Its
  // identity section (1) already carries beatId/name/order/path/type/screenId, so
  // rendering the separate metadata panel above it would duplicate that block.
  if (resolved.bible) {
    return (
      <BiblePanel
        beat={beat}
        bible={resolved.bible}
        io={resolved.io}
        variantOf={entryFull?.variantOf}
        inheritedFrom={resolved.inheritedFrom}
      />
    );
  }

  const resolvedProps = beat.props ? Object.entries(beat.props) : [];

  if (!entry) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          fontFamily: 'Urbanist, -apple-system, sans-serif',
        }}
      >
        <VoiceTag engine={beat.engine} mode={beat.mode} />
        <div
          style={{
            background: '#fff',
            border: '1px dashed #e2e8f0',
            borderRadius: 14,
            padding: '14px 16px',
            fontSize: 12,
            color: '#94a3b8',
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            {beat.id}
            {entryFull?.variantOf && <VariantChip head={entryFull.variantOf} />}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {beat.type}
            {beat.path ? ` · ${PATH_STYLE[beat.path].label}` : ''}
          </div>
          <div style={{ marginTop: 10, lineHeight: 1.45 }}>
            No metadata entry. This is a structural silent beat with no coach copy, script, clip, or
            expected voice response.
          </div>
          <div style={{ marginTop: 10 }}>
            <ContextSection title="Data in / out">
              <IOBlock io={resolved.io} inheritedFrom={resolved.inheritedFrom} />
            </ContextSection>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        fontFamily: 'Urbanist, -apple-system, sans-serif',
      }}
    >
      <VoiceTag engine={beat.engine} mode={beat.mode} />
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          padding: '14px 16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            {beat.id}
            {entryFull?.variantOf && <VariantChip head={entryFull.variantOf} />}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {beat.type}
            {beat.path ? ` · ${PATH_STYLE[beat.path].label}` : ''}
          </div>
          {beat.screenId && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              Screen ID: {beat.screenId}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <WordsFlagChip label={beat.engine} tone="engine" />
          {beat.mode && <WordsFlagChip label={beat.mode} tone="note" />}
          {beat.engine === 'Cartesia' && <WordsFlagChip label="live, name" tone="live" />}
        </div>

        <ContextSection title="Beat metadata" defaultOpen>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {entry.expectedResponse && (
              <ContextKeyValue label="Expected response" value={entry.expectedResponse} />
            )}
            {entry.allowedTools && (
              <ContextKeyValue label="Allowed tools" value={entry.allowedTools} />
            )}
          </div>
        </ContextSection>

        <ContextSection
          title={entry.context ? 'Coach behavior context' : 'Coach behavior context (none)'}
        >
          {entry.context ? (
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 11,
                lineHeight: 1.5,
                color: '#334155',
                background: '#f8fafc',
                border: '1px solid #eef2f7',
                borderRadius: 8,
                padding: '10px 12px',
                maxHeight: 260,
                overflow: 'auto',
              }}
            >
              {entry.context}
            </pre>
          ) : (
            <div style={{ fontSize: 12.5, color: '#94a3b8' }}>
              No coach behavior context for this beat (structural or newer beat).
            </div>
          )}
        </ContextSection>

        <ContextSection
          title={`Resolved props${resolvedProps.length ? ` (${resolvedProps.length})` : ''}`}
        >
          {resolvedProps.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {resolvedProps.map(([key, value]) => (
                <ContextKeyValue key={key} label={key} value={value} />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: '#94a3b8' }}>This beat has no explicit props.</div>
          )}
        </ContextSection>

        <ContextSection title="Data in / out">
          <IOBlock io={resolved.io} inheritedFrom={resolved.inheritedFrom} />
        </ContextSection>
      </div>
    </div>
  );
}

// --- Script panel (right column) ---
// The ordered script list from the ONE source: the exact lines the engine plays
// and runs, in order. Per line: seq, words, the element + screen it binds to and
// whether it is a coach bubble or a component reveal, the voice, and the clip.
// The optional expectedUser sub-row shows under a coach line behind a toggle.

const BIND_STYLE: Record<
  'bubble' | 'component',
  { bg: string; text: string; border: string; label: string }
> = {
  bubble: { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe', label: 'bubble' },
  component: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0', label: 'component' },
};

const VOICE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  mp3: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  cartesia: { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' },
  verbatim: { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' },
};

function TinyChip({
  label,
  s,
}: {
  label: string;
  s: { bg: string; text: string; border: string };
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 7px',
        borderRadius: 99,
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.text,
        fontSize: 10,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function ScriptPanel({
  screenId,
  showExpectedUser,
}: {
  screenId?: string;
  showExpectedUser: boolean;
}) {
  const entry = screenId ? ENTRY_BY_SCREEN_ID[screenId] : undefined;

  if (!entry || entry.script.length === 0) {
    return (
      <div
        style={{
          background: '#fff',
          border: '1px dashed #e2e8f0',
          borderRadius: 14,
          padding: '14px 16px',
          fontSize: 12,
          color: '#94a3b8',
          fontFamily: 'Urbanist, -apple-system, sans-serif',
        }}
      >
        No script lines for this beat (silent or structural).
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        fontFamily: 'Urbanist, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#94a3b8',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        Script ({entry.script.length})
      </div>
      <ol
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {entry.script.map((line: ScriptLine) => {
          const bind = BIND_STYLE[line.bindsTo.kind];
          const voiceStyle = line.voice ? VOICE_STYLE[line.voice] : null;
          return (
            <li
              key={line.seq}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                borderTop: line.seq === 1 ? 'none' : '1px solid #f1f5f9',
                paddingTop: line.seq === 1 ? 0 : 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#c7d2e0',
                    minWidth: 14,
                    flexShrink: 0,
                  }}
                >
                  {line.seq}
                </span>
                <div style={{ fontSize: 13, lineHeight: 1.45, color: '#1e293b', flex: 1 }}>
                  {line.words || (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>(silent reveal)</span>
                  )}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  paddingLeft: 22,
                  alignItems: 'center',
                }}
              >
                <TinyChip label={bind.label} s={bind} />
                <span style={{ fontSize: 10.5, color: '#64748b' }}>{line.bindsTo.element}</span>
                {voiceStyle && <TinyChip label={line.voice as string} s={voiceStyle} />}
                {line.clip && (
                  <span style={{ fontSize: 10.5, color: '#94a3b8' }}>clip: {line.clip}</span>
                )}
              </div>
              {showExpectedUser && line.expectedUser && (
                <div
                  style={{
                    marginLeft: 22,
                    marginTop: 2,
                    padding: '5px 9px',
                    borderRadius: 8,
                    background: 'rgba(19,91,236,0.06)',
                    border: '1px solid rgba(19,91,236,0.12)',
                    fontSize: 11.5,
                    lineHeight: 1.4,
                    color: '#1d4ed8',
                  }}
                >
                  <span style={{ fontWeight: 700 }}>User: </span>
                  {line.expectedUser}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          paddingTop: 4,
          borderTop: '1px solid #f1f5f9',
        }}
      >
        <WordsFlagChip label={entry.voiceEngine} tone="engine" />
        {entry.expectedResponse && (
          <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
            expects: {entry.expectedResponse}
          </span>
        )}
      </div>
    </div>
  );
}

// --- Beats, v3 order + copy. Each names a real registry type, the props it
// passes (coachLine and any seed props), and the engine + mode tag. ---

type BeatPath = 'beginner' | 'advanced' | 'both';

interface FlowBeat {
  id: string;
  // Shown in the beat header row above the phone, alongside the play control.
  name: string;
  type: string;
  props?: Record<string, string>;
  engine: VoiceEngine;
  mode: VoiceMode;
  screenId?: string;
  path?: BeatPath;
  // Hide the docked orb on this beat. The orb fades out before the account step
  // and fades back in at mic permission, so the account beat shows no orb.
  hideOrb?: boolean;
  // The ordered lines Play iterates (the one-source playback driver). Present on
  // onboarding beats (from beatsSource); absent on the hand-authored check-in
  // beats, which still play through the legacy narration path.
  script?: readonly ScriptLine[];
}

// The render starts at the very beginning: splash, get started, the coach
// greeting, sign-up, and mic permission, then straight into profile and the
// rest of the onboarding chain, through the beginner and advanced lanes and
// the five weekly-projection frames.
//
// Derived from the ONE source (beatsSource.ts). The order, id, type, engine,
// mode, screenId, path, hideOrb, and structural props all come from there, so
// the render has a single authored store.
export const BASE_BEATS: FlowBeat[] = BEATS_SOURCE.map((b) => ({
  id: b.id,
  name: b.name,
  type: b.type,
  props: b.props ?? undefined,
  engine: b.voiceEngine,
  mode: b.voiceMode,
  screenId: b.screenId ?? undefined,
  path: b.path,
  hideOrb: b.hideOrb || undefined,
  script: b.script,
}));

export const BEATS: FlowBeat[] = BASE_BEATS.map((beat) => ({
  ...beat,
  props: {
    ...(beat.props ?? {}),
    ...metadataPropsForBeat(beat.type, beat.screenId),
  },
}));

// --- Morning check-in beats ---
// Source: MORNING_CHECKIN_FLOW in FlowBuilder.tsx.
// Beat 2 (state-check) gets a Cartesia . Improvise reaction beat injected right
// after the card, showing where the coach reacts live to the user's morning state.
// Voice tag assignment:
//   morning_greeting  -> MP3 . Verbatim  (scripted opener, pre-recorded)
//   morning_state_prompt -> MP3 . Verbatim (scripted ask, pre-recorded)
//   state reaction    -> Cartesia . Improvise (live reaction to what they said)
//   are_you_done      -> MP3 . Verbatim (scripted line, pre-recorded)
//   morning_wrap      -> MP3 . Verbatim (scripted closer, pre-recorded)
const MORNING_BEATS: FlowBeat[] = [
  // One opener clip (morning_opener): the greeting and the state ask are the
  // same MP3, with the time clip in front. The state card renders under it.
  // One MP3, not two.
  {
    id: 'morning-opener',
    name: 'Morning greeting',
    type: 'state-check',
    props: {
      coachLine:
        "Good morning. How are you feeling this morning? Mood, energy, sleep, any stress on your mind. Just tell me where you're at.",
    },
    engine: 'MP3',
    mode: 'Verbatim',
  },
  {
    id: 'morning-state-reaction',
    name: 'State reaction',
    type: 'coach-bubble',
    props: {
      text: "Energy a little low, that makes sense. Sleep was short. Let's keep today light and focused.",
    },
    engine: 'Cartesia',
    mode: 'Improvise',
  },
  {
    id: 'morning-are-you-done',
    name: 'Anything else?',
    type: 'coach-bubble',
    props: {
      text: 'Looks like there are a few items left. Want to add anything, or should we move on?',
    },
    engine: 'MP3',
    mode: 'Verbatim',
  },
  {
    id: 'morning-wrap',
    name: 'Morning wrap',
    type: 'coach-bubble',
    props: { text: "That's a good start. Go make it a good one." },
    engine: 'MP3',
    mode: 'Verbatim',
  },
];

// --- Evening check-in beats ---
// Source: EVENING_CHECKIN_FLOW in FlowBuilder.tsx.
// Beat 1 is the greeting that also surfaces the habit list (the greeting happens,
// then the habit-review card appears). Beat 4 (reflection) renders the full proud /
// forgive / grateful steps. A Cartesia . Improvise reaction is injected after the
// habit-review card to show where the coach reacts live to the habits report.
// Voice tag assignment:
//   evening_greeting_habits -> MP3 . Verbatim (scripted opener with habit context)
//   habit-review (card)     -> Silent (user taps done/missed/pending, no coach voice)
//   habits reaction         -> Cartesia . Improvise (live reaction to the day's habits)
//   are_you_done            -> MP3 . Verbatim
//   reflection              -> MP3 . Verbatim (transition + 3 questions are all scripted)
//   reflection end reaction -> Cartesia . Improvise (live close after grateful)
//   evening_wrap            -> MP3 . Verbatim
const EVENING_BEATS: FlowBeat[] = [
  {
    id: 'evening-greeting',
    name: 'Evening greeting',
    type: 'coach-bubble',
    props: { text: 'Hey, good evening. Here are your habits for today. How did the day go?' },
    engine: 'MP3',
    mode: 'Verbatim',
  },
  {
    id: 'evening-habit-review',
    name: 'Habit review',
    type: 'habit-review',
    engine: 'Silent',
    mode: null,
  },
  {
    id: 'evening-habits-reaction',
    name: 'Habits reaction',
    type: 'coach-bubble',
    props: { text: "Two out of three, that's solid. The screens one is hard. We'll work on that." },
    engine: 'Cartesia',
    mode: 'Improvise',
  },
  {
    id: 'evening-are-you-done',
    name: 'Anything else?',
    type: 'coach-bubble',
    props: {
      text: 'Looks like there are a few items left. Want to add anything, or should we move on?',
    },
    engine: 'MP3',
    mode: 'Verbatim',
  },
  {
    id: 'evening-reflection',
    name: 'Reflection',
    type: 'reflection',
    props: {
      transition: "Good. Now let's take a moment to reflect on the day itself.",
      proud: 'What are you proud of today?',
      proudAnswer: 'I showed up even though I was tired.',
      forgive: 'What do you forgive yourself for today?',
      forgiveAnswer: 'Skipping my afternoon walk.',
      grateful: 'What are you grateful for today?',
      gratefulAnswer: 'A good talk with my brother.',
    },
    engine: 'MP3',
    mode: 'Verbatim',
  },
  {
    id: 'evening-reflection-reaction',
    name: 'Reflection reaction',
    type: 'coach-bubble',
    props: { text: "That's real. Hold onto the gratitude tonight." },
    engine: 'Cartesia',
    mode: 'Improvise',
  },
  {
    id: 'evening-wrap',
    name: 'Evening wrap',
    type: 'coach-bubble',
    props: { text: "That's it for tonight. Sleep well." },
    engine: 'MP3',
    mode: 'Verbatim',
  },
];

// --- Tab definitions ---
type TabId = 'onboarding' | 'morning' | 'evening';
interface TabDef {
  id: TabId;
  label: string;
  beats: FlowBeat[];
  title: string;
  subtitle: string;
}
const TABS: TabDef[] = [
  {
    id: 'onboarding',
    label: 'Onboarding',
    beats: BEATS,
    title: 'Onboarding flow',
    subtitle: 'Real flow-builder components, v3 content. Voice delivery tagged in the left margin.',
  },
  {
    id: 'morning',
    label: 'Morning check-in',
    beats: MORNING_BEATS,
    title: 'Morning check-in flow',
    subtitle: 'Daily morning check-in: greeting, state card, live reaction, wrap.',
  },
  {
    id: 'evening',
    label: 'Evening check-in',
    beats: EVENING_BEATS,
    title: 'Evening check-in flow',
    subtitle: 'Daily evening check-in: greeting, habit review, reflection, wrap.',
  },
];

// Pill tab switcher rendered above the legend.
function TabSwitcher({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}
    >
      {TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              padding: '7px 18px',
              borderRadius: 99,
              border: isActive ? '2px solid #6366f1' : '2px solid #e2e8f0',
              background: isActive ? '#6366f1' : '#fff',
              color: isActive ? '#fff' : '#475569',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Urbanist, -apple-system, sans-serif',
              transition: 'background 150ms, border-color 150ms, color 150ms',
              outline: 'none',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// A single self-contained phone: the iOS-style status bar, the Coach header, then
// the coach-blue interior holding the beat with the orb docked at the bottom, the
// same chrome the Play view uses. Each annotated beat renders in its own phone so
// the stacked view reads like real app screens, orb and all. The orb is `paused`
// so a wall of them settles into its look then freezes, instead of running many
// perpetual animation loops.
function PhoneCard({
  playing = false,
  showOrb = true,
  children,
}: {
  playing?: boolean;
  showOrb?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        width: '100%',
        boxSizing: 'border-box',
        border: '12px solid #0b0d14',
        borderRadius: 52,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 24px 50px -22px rgba(15,23,42,0.38)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Status bar with a dynamic-island notch */}
      <div
        style={{
          position: 'relative',
          height: 44,
          flexShrink: 0,
          background: '#E8EEFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 22px',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>9:41</span>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 8,
            transform: 'translateX(-50%)',
            width: 96,
            height: 24,
            borderRadius: 999,
            background: '#0b0d14',
          }}
        />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#0f172a' }}>
          <Icon icon="mdi:signal-cellular-3" width={13} height={13} />
          <Icon icon="mdi:wifi" width={13} height={13} />
          <Icon icon="mdi:battery" width={15} height={15} />
        </span>
      </div>
      {/* Coach header: just "Coach", so the phone mirrors the real app screen
          exactly. The play control and the engine chip live in the beat header
          row above the phone (BeatHeader), not inside the phone. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 18px',
          flexShrink: 0,
          background: '#E8EEFC',
          borderBottom: '1px solid rgba(15,23,42,0.06)',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Coach</span>
      </div>
      {/* Coach-blue interior: the beat at the top, the orb docked at the bottom on
          the same gradient (no white bar). The min height makes every phone at
          least a full real-phone screen; tall beats grow past it (longer than a
          phone) so nothing is ever clipped or shrunk below a phone. */}
      <div
        style={{ background: COACH_BG, display: 'flex', flexDirection: 'column', minHeight: 700 }}
      >
        <div
          style={{ flex: 1, padding: '18px 14px 8px', display: 'flex', flexDirection: 'column' }}
        >
          {children}
        </div>
        {showOrb && (
          <div
            style={{
              flexShrink: 0,
              padding: '8px 0 20px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            {/* The orb animates live while this beat is playing, and settles to a
                frozen bloom otherwise so a stack of them stays cheap. Hidden on
                beats where the orb has faded out (the account step). */}
            <Orb {...orbSpeaking(72, 'coach', { frozen: !playing })} />
          </div>
        )}
      </div>
    </div>
  );
}

// One annotated beat that can be played in place: press play and it runs this
// beat's narration (browser voice standing in for the recorded MP3 / Cartesia
// clip) with the real reveal + karaoke sync, right inside its phone. Not playing,
// it renders settled (every element shown), exactly the static annotated view.
// Only one beat plays at a time, coordinated by the parent through `active`.
function PlayableBeat({
  beat,
  active,
  onDone,
}: {
  beat: FlowBeat;
  active: boolean;
  onDone: () => void;
}) {
  const [stepReveal, setStepReveal] = useState<number | null>(null);
  const [elementReveal, setElementReveal] = useState<number | null>(null);
  const [syncWords, setSyncWords] = useState<number | null>(null);
  const runRef = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!active) return;
    const run = ++runRef.current;
    let cancelled = false;
    (async () => {
      // Let the fresh remount settle to an empty state, then run the beat.
      await raf();
      if (beat.script && beat.script.length) {
        // Onboarding beats play straight off the one-source script[].
        await runBeatScript({
          script: beat.script,
          muted: false,
          setStepReveal,
          setElementReveal,
          setSyncWords,
          shouldStop: () => cancelled || run !== runRef.current,
          beatType: beat.type,
        });
      } else {
        // Beats without a script[] (hand-authored check-in beats): drive the
        // opener off the resolved coach-copy props. No legacy metadata store.
        const opener = sample(beat.props?.coachLine ?? beat.props?.greeting ?? '');
        await runBeatNarration({
          narration: undefined,
          kind: kindOf(beat.type),
          opener,
          lines: [],
          muted: false,
          setStepReveal,
          setElementReveal,
          setSyncWords,
          shouldStop: () => cancelled || run !== runRef.current,
        });
      }
      if (!cancelled && run === runRef.current) onDoneRef.current();
    })();
    return () => {
      // Cancelled (another beat pressed, tab switch, unmount): stop the voice and
      // drop back to the settled state.
      cancelled = true;
      runRef.current += 1;
      stopSpeech();
      setStepReveal(null);
      setElementReveal(null);
      setSyncWords(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <PhoneCard playing={active} showOrb={!beat.hideOrb}>
      <SpokenWordsCtx.Provider value={active ? syncWords : null}>
        <IsolatedBeat
          key={`${beat.id}-${active ? 'active' : 'idle'}`}
          type={beat.type}
          props={beat.props}
          animated={active}
          stepReveal={active ? stepReveal : null}
          elementReveal={active ? elementReveal : null}
        />
      </SpokenWordsCtx.Provider>
    </PhoneCard>
  );
}

// --- Concept grouping for the annotated render ---
// The onboarding source authors each category opener (goals-list) and each
// per-goal habit opener (habit-picker) as its own beat, because each selection
// has its own screenId, copy, and clip. Flat, that reads as ~62 near-identical
// screens and looks like mistakes. But those are variations of TWO concepts whose
// copy and clip resolve at runtime by the picked category / goal. Coalesce each
// run under ONE collapsible concept header so the render READS as concept beats.
// The underlying data stays flat and untouched: every variation keeps its own
// screenId, copy, and clip, still validated by the render guards and still
// resolved at runtime. Collapsed by default (reads as concepts); expand to
// inspect every variation exactly as before.
export type ConceptKey = 'goals' | 'habits';

// A beat belongs to a concept if it is one of the per-selection variants of that
// concept. Every goals-list beat is a category opener; every habit-picker beat is
// a goal opener, INCLUDING the generic 'habits' fallback (order 22) whose screen
// is the same habit-picker as the per-goal variants — folding it in stops the
// generic + first per-goal beats double-rendering the picker back to back.
export function conceptOf(beat: FlowBeat): ConceptKey | null {
  if (beat.type === 'goals-list') return 'goals';
  if (beat.type === 'habit-picker') return 'habits';
  return null;
}

// Coalesce a flow into concept runs: each contiguous run of same-concept variant
// beats becomes one group; every other beat is a run of one with concept null.
// Shared by the annotated stack (FlowPhoneFrame) and #play (FlowPlay) so a variant
// screen renders ONCE in both, never N times in a row.
export interface ConceptRun {
  concept: ConceptKey | null;
  beats: FlowBeat[];
  start: number;
}
export function buildConceptRuns(beats: FlowBeat[]): ConceptRun[] {
  const runs: ConceptRun[] = [];
  for (let i = 0; i < beats.length; ) {
    const concept = conceptOf(beats[i]);
    if (concept) {
      const start = i;
      while (i < beats.length && conceptOf(beats[i]) === concept) i += 1;
      runs.push({ concept, beats: beats.slice(start, i), start });
    } else {
      runs.push({ concept: null, beats: [beats[i]], start: i });
      i += 1;
    }
  }
  return runs;
}

export const CONCEPT_META: Record<ConceptKey, { title: string; sub: string }> = {
  goals: {
    title: 'Goals — category opener',
    sub: 'One concept. The opener copy and clip resolve at runtime from the category the user picked.',
  },
  habits: {
    title: 'Habits — per-goal opener',
    sub: 'One concept. The opener copy and clip resolve at runtime from the goal the user picked.',
  },
};

// The label to flip variations by: the category the user picked (goals) or the
// goal they picked (habits). The generic habit-picker (no goal yet) reads as such.
export function variationLabel(b: FlowBeat): string {
  return b.props?.category ?? b.props?.goal ?? (b.id === 'habits' ? 'Any goal (generic)' : b.id);
}

// A variation's opener line, read straight off the one source by screenId, so the
// openers list matches exactly what the phone + script panel show.
export function conceptOpener(b: FlowBeat): string {
  return scriptOpener(b.screenId ? ENTRY_BY_SCREEN_ID[b.screenId] : undefined);
}

// A run of same-concept variation beats, shown as one collapsible concept card.
// Collapsed, it reads as a single concept beat. Expanded, a variation switcher
// (prev/next + a dropdown of the category/goal labels) swaps ONE variation IN
// PLACE — the phone, the script panel, and the metadata all update to the picked
// category/goal — so every option can be flipped through and compared on the same
// screen without un-collapsing into 37 cards. Every variation's opener line is
// also listed at once in the detail panel below.
function ConceptGroup({
  concept,
  beats,
  startIndex,
  renderRow,
}: {
  concept: ConceptKey;
  beats: FlowBeat[];
  startIndex: number;
  renderRow: (beat: FlowBeat, globalIndex: number) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const meta = CONCEPT_META[concept];
  const count = beats.length;
  const idx = Math.min(sel, count - 1);
  const current = beats[idx];
  const go = (d: number) => setSel((s) => (Math.min(s, count - 1) + d + count) % count);

  const ctrlBtn: CSSProperties = {
    border: '1px solid #cbd5e1',
    background: '#fff',
    borderRadius: 999,
    width: 30,
    height: 30,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    color: '#334155',
    lineHeight: 1,
  };

  return (
    <div style={{ marginBottom: 34 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          border: '1px solid #cbd5e1',
          borderRadius: 16,
          background: '#eef2f7',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <span
          style={{
            fontSize: 16,
            color: '#475569',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform .15s',
            lineHeight: 1,
          }}
        >
          {'▸'}
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
            {meta.title}
          </span>
          <span style={{ display: 'block', fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
            {meta.sub}
          </span>
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#3730a3',
            background: 'rgba(99,102,241,0.12)',
            padding: '4px 11px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}
        >
          {count} variations {open ? '· hide' : '· flip through'}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 16 }}>
          {/* Variation switcher: flip one variation in place. Prev/next + a
              dropdown of the category/goal labels. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>Variation</span>
            <button
              type="button"
              style={ctrlBtn}
              onClick={() => go(-1)}
              aria-label="Previous variation"
            >
              {'◀'}
            </button>
            <select
              value={idx}
              onChange={(e) => setSel(Number(e.target.value))}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#0f172a',
                padding: '6px 10px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#fff',
                cursor: 'pointer',
                maxWidth: 280,
              }}
            >
              {beats.map((b, i) => (
                <option key={b.id} value={i}>
                  {i + 1}. {variationLabel(b)}
                </option>
              ))}
            </select>
            <button type="button" style={ctrlBtn} onClick={() => go(1)} aria-label="Next variation">
              {'▶'}
            </button>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              {idx + 1} / {count} · {current.screenId ?? current.id}
            </span>
          </div>

          {/* The picked variation, rendered in place: phone + script + metadata all
              swap to this category/goal. */}
          {renderRow(current, startIndex + idx)}

          {/* Every variation's opener, visible at once. Click a row to flip to it. */}
          <div
            style={{
              marginTop: 8,
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              background: '#f8fafc',
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.4,
                color: '#64748b',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              All {count} variation openers
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {beats.map((b, i) => {
                const active = i === idx;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSel(i)}
                    style={{
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: 'none',
                      borderRadius: 9,
                      padding: '7px 10px',
                      background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'baseline',
                    }}
                  >
                    <span
                      style={{
                        flex: '0 0 150px',
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: active ? '#3730a3' : '#0f172a',
                      }}
                    >
                      {i + 1}. {variationLabel(b)}
                    </span>
                    <span style={{ flex: 1, fontSize: 12.5, color: '#475569', lineHeight: 1.45 }}>
                      {conceptOpener(b)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Global bible panel: the flow-level GLOBAL layer every beat inherits ---
// One card, mounted once above the first beat on the annotated (onboarding) tab.
// All 11 sections collapsed by default; only the summary header is always visible.

function GlobalBiblePanel() {
  const filesByArea = FILES_SYNC_MAP.reduce<Record<string, FileMapRow[]>>((acc, row) => {
    (acc[row.area] ??= []).push(row);
    return acc;
  }, {});

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        marginBottom: 34,
        maxWidth: TOTAL_W,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          justifyContent: 'space-between',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
            Global layer (applies to every beat)
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            flowBible.ts — laws, global rules, contracts, the enforcer registry, canonical enums,
            files/save/sync map
          </div>
        </div>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            padding: '1px 7px',
            borderRadius: 99,
            background: '#eaf1ff',
            color: '#135bec',
            border: '1px solid #c7d8ff',
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          flow-level
        </span>
      </div>

      {/* 1. Improvisation law (windows resolved OFF, Yair 2026-07-09) */}
      <ContextSection
        title="1 · Improvisation law"
        badge={<StatusChip status="verified" label="OFF for onboarding (Yair, LOCKED)" />}
      >
        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#334155' }}>
          {IMPROVISATION.law}
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {IMPROVISATION.windows.map((w) => (
            <div
              key={w.id}
              style={{
                padding: '7px 9px',
                borderRadius: 8,
                background: '#f8fafc',
                border: '1px solid #eef2f7',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <MonoTag label={w.id} />
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{w.where}</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: '#334155', marginTop: 4 }}>
                <span style={{ fontWeight: 700, color: '#94a3b8' }}>opens: </span>
                {w.opens}
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: '#334155' }}>
                <span style={{ fontWeight: 700, color: '#94a3b8' }}>bounds: </span>
                {w.bounds}
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: '#334155' }}>
                <span style={{ fontWeight: 700, color: '#94a3b8' }}>must not: </span>
                {w.mustNot}
              </div>
            </div>
          ))}
        </div>
        <EnforcerRow enforcedBy={IMPROVISATION.enforcedBy} />
      </ContextSection>

      {/* 2. Global rules */}
      <ContextSection title={`2 · Global rules (${GLOBAL_RULES.rules.length})`}>
        <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#64748b', marginBottom: 8 }}>
          {GLOBAL_RULES.precedence}
        </div>
        <RuleRows rules={GLOBAL_RULES.rules} />
      </ContextSection>

      {/* 3. Tool failure contract */}
      <ContextSection
        title="3 · Tool failure contract"
        badge={<StatusChip status={TOOL_FAILURE.status} />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ContextKeyValue label="Retry" value={TOOL_FAILURE.retry} />
          <ContextKeyValue label="Voice" value={TOOL_FAILURE.voice} />
          <ContextKeyValue label="Text / tap" value={TOOL_FAILURE.textOrTap} />
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#94a3b8',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Never
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {TOOL_FAILURE.never.map((n) => (
                <div key={n} style={{ fontSize: 12, lineHeight: 1.45, color: '#334155' }}>
                  · {n}
                </div>
              ))}
            </div>
          </div>
        </div>
        <EnforcerRow enforcedBy={TOOL_FAILURE.enforcedBy} />
      </ContextSection>

      {/* 4. Multi-turn model (global defaults; per-beat detail is section 13 on the beat) */}
      <ContextSection title="4 · Multi-turn model (global defaults)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ContextKeyValue label="Placement" value={CONVERSATION_MODEL.placement} />
          <ContextKeyValue label="Loop" value={CONVERSATION_MODEL.loop} />
          <ContextKeyValue
            label="Defaults"
            value={`maxTurns ${CONVERSATION_MODEL.defaults.maxTurns} · onMaxTurns: ${CONVERSATION_MODEL.defaults.onMaxTurns}`}
          />
        </div>
      </ContextSection>

      {/* 5. Data passing contract */}
      <ContextSection
        title="5 · Data passing contract"
        badge={<StatusChip status={DATA_PASSING.status} />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ContextKeyValue label="Rule" value={DATA_PASSING.rule} />
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#94a3b8',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Transport
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {DATA_PASSING.transport.map((t) => (
                <div key={t} style={{ fontSize: 12, lineHeight: 1.45, color: '#334155' }}>
                  · {t}
                </div>
              ))}
            </div>
          </div>
          <ContextKeyValue label="Forbidden" value={DATA_PASSING.forbidden} />
          <ContextKeyValue label="Cold resume" value={DATA_PASSING.coldResume} />
        </div>
        <EnforcerRow enforcedBy={DATA_PASSING.enforcedBy} />
      </ContextSection>

      {/* 6. Coach = the LLM */}
      <ContextSection title="6 · Coach = the LLM">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ContextKeyValue label="Is" value={COACH_IDENTITY.is} />
          <ContextKeyValue label="Governed by" value={COACH_IDENTITY.governedBy} />
          <ContextKeyValue label="Backend boundary" value={COACH_IDENTITY.backendBoundary} />
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#94a3b8',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Paths
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {COACH_IDENTITY.paths.map((p) => (
                <div key={p} style={{ fontSize: 12, lineHeight: 1.45, color: '#334155' }}>
                  · {p}
                </div>
              ))}
            </div>
          </div>
        </div>
      </ContextSection>

      {/* 7. Consumer contract */}
      <ContextSection title={`7 · Consumer contract (${CONSUMER_CONTRACT.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CONSUMER_CONTRACT.map((row) => {
            const warn = row.today.startsWith('NOT WIRED');
            return (
              <div
                key={row.surface}
                style={{
                  padding: '7px 9px',
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #eef2f7',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{row.surface}</div>
                <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#334155', marginTop: 2 }}>
                  {row.mustRead}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    lineHeight: 1.45,
                    marginTop: 4,
                    color: warn ? '#b45309' : '#64748b',
                    fontWeight: warn ? 700 : 400,
                  }}
                >
                  {row.today}
                </div>
              </div>
            );
          })}
        </div>
      </ContextSection>

      {/* 8. Enforcer registry */}
      <ContextSection title={`8 · Enforcer registry (${ENFORCER_REGISTRY.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ENFORCER_REGISTRY.map((e) => (
            <div
              key={e.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                padding: '5px 0',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <MonoTag label={e.id} />
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{e.kind}</span>
              <StatusChip status={e.status} />
              <span style={{ fontSize: 11.5, color: '#334155', flex: 1, minWidth: 160 }}>
                {e.meaning}
              </span>
              <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{e.owner}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 10.5, lineHeight: 1.6, color: '#94a3b8' }}>
          <span style={{ fontWeight: 700 }}>Retired ids: </span>
          {Object.entries(RETIRED_ENFORCER_IDS)
            .map(([from, to]) => `${from} → ${to}`)
            .join(', ')}
        </div>
      </ContextSection>

      {/* 9. Canonical enums */}
      <ContextSection title="9 · Canonical enums">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>gender</span>
              <StatusChip status={CANONICAL_ENUMS.gender.status} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              {CANONICAL_ENUMS.gender.values.map((v) => (
                <MonoTag key={v} label={v} />
              ))}
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#334155' }}>
              {CANONICAL_ENUMS.gender.womenArtSelector}
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.45, color: '#64748b', marginTop: 2 }}>
              {CANONICAL_ENUMS.gender.note}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>categories</span>
              <StatusChip status={CANONICAL_ENUMS.categories.status} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              {CANONICAL_ENUMS.categories.values.map((v) => (
                <MonoTag key={v} label={v} />
              ))}
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.45, color: '#64748b' }}>
              {CANONICAL_ENUMS.categories.note}
            </div>
          </div>
        </div>
      </ContextSection>

      {/* 10. Open decisions */}
      <ContextSection title={`10 · Open decisions (${OPEN_DECISIONS.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {OPEN_DECISIONS.map((d) => (
            <div
              key={d.id}
              style={{
                padding: '7px 9px',
                borderRadius: 8,
                background: d.decided ? '#f0fdf4' : '#f8fafc',
                border: `1px solid ${d.decided ? '#bbf7d0' : '#eef2f7'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <MonoTag label={d.id} />
                {d.decided ? (
                  <StatusChip status="verified" label="DECIDED" />
                ) : (
                  <StatusChip status="needs-yair" label={d.decider} />
                )}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                {d.question}
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#334155', marginTop: 2 }}>
                {d.decided ?? d.proposal}
              </div>
            </div>
          ))}
        </div>
      </ContextSection>

      {/* 11. Files + save + sync map */}
      <ContextSection title={`11 · Files + save + sync map (${FILES_SYNC_MAP.length})`}>
        {FILES_SYNC_MAP.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(filesByArea).map(([area, rows]) => (
              <details key={area} style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                <summary
                  style={{
                    cursor: 'pointer',
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {area} ({rows.length})
                </summary>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {rows.map((row) => (
                    <div
                      key={row.file}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 7,
                        background: '#f8fafc',
                        border: '1px solid #eef2f7',
                        fontSize: 11.5,
                        lineHeight: 1.4,
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                      >
                        <MonoTag label={row.file} />
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>{row.authored}</span>
                      </div>
                      <div style={{ color: '#334155', marginTop: 2 }}>{row.role}</div>
                      <div style={{ color: '#64748b', marginTop: 2 }}>
                        <span style={{ fontWeight: 700 }}>saves to: </span>
                        {row.savesTo}
                      </div>
                      <div style={{ color: '#64748b' }}>
                        <span style={{ fontWeight: 700 }}>sync: </span>
                        {row.syncEdge}
                      </div>
                      {row.staleRisk !== 'low' && (
                        <div style={{ color: '#9a3412', marginTop: 2 }}>
                          <span style={{ fontWeight: 700 }}>stale risk: </span>
                          {row.staleRisk}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Not yet populated (files-sync-inventory sweep pending).
          </div>
        )}
      </ContextSection>
    </div>
  );
}

// Shared phone frame renderer. Each beat renders in its OWN phone card, with the
// source-of-truth rail in the left margin on the Onboarding tab. Runs of
// same-concept variation beats (the category and per-goal openers) are coalesced
// under one collapsible concept card so the render reads as concept beats.
function FlowPhoneFrame({
  beats,
  showWords = false,
  showExpectedUser = false,
  playingId,
  onRequestPlay,
}: {
  beats: FlowBeat[];
  showWords?: boolean;
  showExpectedUser?: boolean;
  playingId: string | null;
  onRequestPlay: (id: string | null) => void;
}) {
  const frameWidth = showWords ? TOTAL_W + WORDS_GAP + WORDS_COL_W : TOTAL_W;

  // One beat's row, unchanged. i is the beat's index in the full flow so path
  // banners and beat numbers stay correct whether the row is standalone or inside
  // a concept group.
  const beatRow = (b: FlowBeat, i: number) => {
    const branched = b.path === 'beginner' || b.path === 'advanced';
    const isStart = branched && b.path !== beats[i - 1]?.path;
    const isEnd = branched && b.path !== beats[i + 1]?.path;
    const isPlaying = playingId === b.id;
    return (
      <div key={b.id} data-beat-id={b.id} style={{ marginBottom: 34 }}>
        {/* The beat header (number, name, engine chip, play control) renders for
            every beat on every tab: the play control + chip moved out of the
            phone, so they live here now. */}
        <BeatHeader
          n={i + 1}
          beat={b}
          playing={isPlaying}
          onTogglePlay={() => onRequestPlay(isPlaying ? null : b.id)}
        />
        {showWords && isStart && <PathBanner path={b.path} edge="start" />}
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {/* Left rail: compact voice tag on non-onboarding tabs, full metadata
              panel on the onboarding tab. */}
          <div
            style={{
              flex: `0 0 ${TAG_COL_W}px`,
              paddingRight: TAG_GAP,
              paddingTop: showWords ? 8 : 16,
            }}
          >
            {showWords ? (
              <SourceOfTruthPanel beat={b} />
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <VoiceTag engine={b.engine} mode={b.mode} />
              </div>
            )}
          </div>
          {/* Phone column: a self-contained phone with the orb, playable in place. */}
          <div style={{ flex: `0 0 ${PHONE_W}px` }}>
            <PlayableBeat beat={b} active={isPlaying} onDone={() => onRequestPlay(null)} />
          </div>
          {showWords && (
            <div style={{ flex: `0 0 ${WORDS_COL_W}px`, marginLeft: WORDS_GAP, paddingTop: 8 }}>
              <ScriptPanel screenId={b.screenId} showExpectedUser={showExpectedUser} />
            </div>
          )}
        </div>
        {showWords && isEnd && <PathBanner path={b.path} edge="end" />}
      </div>
    );
  };

  // Walk the flow, coalescing each contiguous run of same-concept variation beats
  // into one collapsible ConceptGroup, leaving every other beat as its own row.
  const rows: ReactNode[] = buildConceptRuns(beats).map((run) =>
    run.concept ? (
      <ConceptGroup
        key={`concept-${run.concept}-${run.start}`}
        concept={run.concept}
        beats={run.beats}
        startIndex={run.start}
        renderRow={beatRow}
      />
    ) : (
      beatRow(run.beats[0], run.start)
    ),
  );

  return (
    <div style={{ width: frameWidth, maxWidth: '100%', margin: '0 auto' }}>
      {/* Global layer (flowBible.ts), once, above the first beat -- only on the
          annotated (source-of-truth) view. */}
      {showWords && <GlobalBiblePanel />}
      {/* Per-beat rows plus coalesced concept groups. The source-of-truth rail
          (left) and the phone (right) are top-aligned in one row. A path banner
          sits above the row when the beat starts a path branch. */}
      {rows}
    </div>
  );
}

export function FlowDesigner() {
  const [activeTab, setActiveTab] = useState<TabId>('onboarding');
  // The beat currently playing in place (its play button pressed), or null. Only
  // one beat plays at a time; setting this to another id stops the previous one.
  const [playingId, setPlayingId] = useState<string | null>(null);
  // Show the expected user response as a sub-row under each coach line in the
  // script panel. Off by default (Yair is still deciding if it belongs here).
  const [showExpectedUser, setShowExpectedUser] = useState(false);
  const tab = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '32px 16px',
        fontFamily: 'Urbanist, -apple-system, sans-serif',
        background: '#e8ecf1',
      }}
    >
      {/* Page header */}
      <div style={{ maxWidth: 720, margin: '0 auto 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
          Guided Growth
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0, marginBottom: 4 }}>
          {tab.title}
        </h1>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>{tab.subtitle}</p>
      </div>

      {/* Tab switcher + Legend */}
      <div style={{ maxWidth: 720, margin: '0 auto 8px' }}>
        <TabSwitcher
          active={activeTab}
          onChange={(t) => {
            setPlayingId(null);
            setActiveTab(t);
          }}
        />
        <VoiceLegend />
        {tab.id === 'onboarding' && (
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12.5,
              color: '#64748b',
              cursor: 'pointer',
              marginBottom: 16,
            }}
          >
            <input
              type="checkbox"
              checked={showExpectedUser}
              onChange={(e) => setShowExpectedUser(e.target.checked)}
            />
            Show expected user response under each coach line
          </label>
        )}
      </div>

      {/* Main layout */}
      <FlowPhoneFrame
        beats={tab.beats}
        showWords={tab.id === 'onboarding'}
        showExpectedUser={showExpectedUser}
        playingId={playingId}
        onRequestPlay={setPlayingId}
      />
    </div>
  );
}
