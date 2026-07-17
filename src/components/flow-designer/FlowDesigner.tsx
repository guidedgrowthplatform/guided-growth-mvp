import { Icon } from '@iconify/react';
import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
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
  BEAT_BY_ID,
  type BeatEntry,
  type ScriptLine,
} from './beatsSource';
import {
  GLOBAL_AMENDED_CONTRACTS,
  GLOBAL_CANONICAL_ENUMS,
  GLOBAL_CONSUMER_CONTRACT,
  GLOBAL_CONVERSATION_MODEL,
  GLOBAL_DATA_PASSING_ROWS,
  GLOBAL_DECISIONS,
  GLOBAL_ENFORCEMENT_REGISTRY,
  GLOBAL_LAYER_PROVENANCE,
  GLOBAL_LAYER_RULES,
  GLOBAL_LAYER_CONFLICT_SEMANTICS,
  GLOBAL_LAYER_TOPIC_RULE_IDS,
  GLOBAL_REACTIVE_SLOTS,
  GLOBAL_RESOLVED_DATA_CONTRACTS,
  GLOBAL_RETIRED_ENFORCER_MAPPINGS,
  GLOBAL_TOOL_FAILURE_ROWS,
  GLOBAL_UNRESOLVED_GOVERNANCE,
  type EnforcementStatus,
  type GlobalDisplayRow,
} from './globalLayer';
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
// script, keyed by beat id, so the words the component shows are the words the
// engine speaks.
const ENTRY_BY_ID = BEAT_BY_ID;

function entryFor(id?: string): BeatEntry | undefined {
  return id ? ENTRY_BY_ID[id] : undefined;
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
function metadataPropsForBeat(type: string, id?: string): Record<string, string> {
  const entry = entryFor(id);
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
// light demo values so each beat looks interactive on its own.
export function usePlayFlowState(): FlowState {
  const [path, setPath] = useState<'new' | 'exp' | null>('new');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [category, setCategoryState] = useState<string | null>('Sleep better');
  const [goals, setGoals] = useState<string[]>(['Fall asleep earlier']);
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
    gender,
    category,
    goals,
    habits,
    setPath,
    setGender,
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
  flowState: suppliedFlowState,
}: {
  type: string;
  props?: Record<string, string>;
  animated?: boolean;
  stepReveal?: number | null;
  elementReveal?: number | null;
  flowState?: FlowState;
}) {
  const isolatedFlowState = usePlayFlowState();
  const flowState = suppliedFlowState ?? isolatedFlowState;

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

// A thin divider plus the beat number above each beat, so a beat's position in
// the flow is clear at a glance.
// The beat number in the annotated render comes from the beat id (beat-<n>-...),
// NOT the array position, so variants of one beat share their base number and the
// heading can never contradict the id. Falls back to position if unparseable.
export function beatNumberFromId(id: string, fallbackIndex: number): number {
  const m = id.match(/beat-(\d+)-/);
  return m ? Number(m[1]) : fallbackIndex + 1;
}

function BeatDivider({ n }: { n: number }) {
  return (
    <div style={{ marginTop: 28, marginBottom: 10 }}>
      <div style={{ height: 1, background: '#cbd5e1', width: '100%' }} />
      <div
        data-beat-number={n}
        style={{
          marginTop: 6,
          marginLeft: TAG_COL_W + TAG_GAP,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#64748b',
          fontFamily: 'Urbanist, -apple-system, sans-serif',
        }}
      >
        Beat {n}
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
  children,
}: {
  title: string;
  defaultOpen?: boolean;
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
        }}
      >
        {title}
      </summary>
      <div style={{ marginTop: 8 }}>{children}</div>
    </details>
  );
}

function ContextKeyValue({ label, value }: { label: string; value: ReactNode }) {
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

function ContextSubheading({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: '#94a3b8',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}

function NoneMarker({ children = 'none' }: { children?: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        width: 'fit-content',
        padding: '2px 7px',
        borderRadius: 99,
        border: '1px solid #e2e8f0',
        background: '#f8fafc',
        color: '#94a3b8',
        fontSize: 10.5,
        fontStyle: 'italic',
      }}
    >
      {children}
    </span>
  );
}

function ContextTable({
  columns,
  rows,
}: {
  columns: readonly string[];
  rows: readonly (readonly ReactNode[])[];
}) {
  if (!rows.length) return <NoneMarker />;

  return (
    <div style={{ border: '1px solid #eef2f7', borderRadius: 8 }}>
      <table
        style={{
          width: '100%',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          fontSize: 10.5,
          color: '#334155',
        }}
      >
        <thead style={{ background: '#f8fafc', color: '#64748b' }}>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                style={{
                  padding: '6px 7px',
                  textAlign: 'left',
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  verticalAlign: 'top',
                }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} style={{ borderTop: '1px solid #eef2f7' }}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  style={{
                    padding: '6px 7px',
                    lineHeight: 1.35,
                    verticalAlign: 'top',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {cell || <NoneMarker />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContextRows({
  rows,
  watchOut,
  enforcedBy,
  status,
  pending,
}: {
  rows: readonly { readonly label: string; readonly value: string }[];
  watchOut?: string;
  enforcedBy?: readonly string[];
  status?: string;
  pending?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((row) => (
        <ContextKeyValue key={row.label} label={row.label} value={row.value} />
      ))}
      {watchOut && <ContextKeyValue label="Watch out" value={watchOut} />}
      {status && <ContextKeyValue label="Source status" value={status} />}
      {pending && <ContextKeyValue label="Pending" value="yes" />}
      {enforcedBy?.length ? (
        <ContextKeyValue label="Enforced by" value={enforcedBy.join(', ')} />
      ) : null}
    </div>
  );
}

function EnforcementChips({ ids }: { ids: readonly string[] }) {
  if (!ids.length) return <NoneMarker />;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {ids.map((id) => (
        <WordsFlagChip key={id} label={id} tone="note" />
      ))}
    </div>
  );
}

function beatEnforcementIds(entry: BeatEntry): readonly string[] {
  const bible = entry.bible;
  if (!bible) return [];

  const ids = [
    ...(bible.identity?.enforcedBy ?? []),
    ...(bible.scriptMeta?.enforcedBy ?? []),
    ...(bible.components?.enforcedBy ?? []),
    ...(bible.voice?.enforcedBy ?? []),
    ...(bible.rulesContext ?? []).flatMap((rule) => rule.enforcedBy),
    ...(bible.rulesCode ?? []).flatMap((rule) => rule.enforcedBy),
    ...(bible.contextProse?.enforcedBy ?? []),
    ...(bible.allowedTools?.enforcedBy ?? []),
    ...(bible.persistence?.enforcedBy ?? []),
    ...(bible.flow?.enforcedBy ?? []),
    ...(bible.edges?.enforcedBy ?? []),
    ...(bible.acceptance?.enforcedBy ?? []),
    ...(bible.applicableDecisions?.enforcedBy ?? []),
  ];

  return [...new Set(ids)];
}

function GlobalContextPanel() {
  const statusColors: Record<EnforcementStatus, { background: string; color: string }> = {
    REAL: { background: '#dcfce7', color: '#166534' },
    PARTIAL: { background: '#fef3c7', color: '#92400e' },
    'NOT-IMPLEMENTED': { background: '#fee2e2', color: '#991b1b' },
  };
  const rulesFor = (ids: readonly string[]) => GLOBAL_LAYER_RULES.filter((rule) => ids.includes(rule.id));
  const baseDetails = {
    style: { border: '1px solid #e2e8f0', borderRadius: 9, background: '#fff', padding: '9px 10px' },
  };
  const Enforcers = ({ enforcers }: { enforcers: readonly { id: string; status: EnforcementStatus }[] }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
      {enforcers.map((enforcer) => <span key={enforcer.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #cbd5e1', borderRadius: 999, background: '#fff', padding: '2px 6px', fontSize: 10 }}><code>{enforcer.id}</code><span style={{ borderRadius: 999, padding: '1px 4px', fontSize: 9, fontWeight: 800, ...statusColors[enforcer.status] }}>{enforcer.status}</span></span>)}
    </div>
  );
  const Rules = ({ ids }: { ids: readonly string[] }) => <div style={{ display: 'grid', gap: 8 }}>{rulesFor(ids).map((rule) => <article key={rule.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', padding: '9px 10px' }}><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontWeight: 800 }}><code>{rule.id}</code><span>{rule.severity}</span><span>— {rule.title}</span></div><div style={{ marginTop: 5 }}>{rule.text}</div>{rule.example && <div style={{ marginTop: 5, color: '#475569' }}><strong>Example:</strong> {rule.example}</div>}<Enforcers enforcers={rule.enforcedBy} /></article>)}</div>;
  const Rows = ({ rows }: { rows: readonly GlobalDisplayRow[] }) => <div style={{ display: 'grid', gap: 6 }}>{rows.map((row) => <div key={row.label} style={{ borderLeft: '3px solid #94a3b8', paddingLeft: 8 }}><strong>{row.label}:</strong> {row.value}</div>)}</div>;
  const Topic = ({ number, title, children }: { number: number; title: string; children: ReactNode }) => <details {...baseDetails}><summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 800, color: '#334155' }}>{number}. {title}</summary><div style={{ display: 'grid', gap: 10, marginTop: 10 }}>{children}</div></details>;

  return (
    <section
      data-rail-section="global-context"
      style={{
        maxWidth: TOTAL_W,
        margin: '0 auto 24px',
        padding: '14px 16px',
        border: '1px solid #cbd5e1',
        borderRadius: 14,
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Global layer — full proposed set, by topic</div>
      <div style={{ display: 'grid', gap: 14, marginTop: 12, color: '#334155', fontSize: 12, lineHeight: 1.5 }}>
        <div style={{ border: '1px solid #fecaca', borderRadius: 8, background: '#fff1f2', color: '#9f1239', fontWeight: 800, padding: '8px 10px' }}>
          {GLOBAL_LAYER_PROVENANCE}
        </div>
        <Topic number={1} title="Authority, precedence, and safety"><div style={{ color: '#64748b' }}><strong>Conflict semantics:</strong> {GLOBAL_LAYER_CONFLICT_SEMANTICS}</div><Rules ids={GLOBAL_LAYER_TOPIC_RULE_IDS.authority} /></Topic>
        <Topic number={2} title="Coach output and conversation model"><Rules ids={GLOBAL_LAYER_TOPIC_RULE_IDS.coach} /><Rows rows={GLOBAL_CONVERSATION_MODEL} /></Topic>
        <Topic number={3} title="Current-beat input and picker behavior"><Rules ids={GLOBAL_LAYER_TOPIC_RULE_IDS.input} /><div style={{ display: 'grid', gap: 8 }}>{GLOBAL_REACTIVE_SLOTS.map((slot) => <article key={slot.id} style={{ border: '1px solid #dbeafe', borderRadius: 8, background: '#eff6ff', padding: '9px 10px' }}><code style={{ fontWeight: 800 }}>{slot.id}</code>{slot.responseRows.map((row) => <div key={row.label} style={{ marginTop: 4 }}><strong>{row.label}:</strong> {row.value}</div>)}</article>)}</div></Topic>
        <Topic number={4} title="Progress, state, and completion"><Rules ids={GLOBAL_LAYER_TOPIC_RULE_IDS.progress} /><Rows rows={GLOBAL_DATA_PASSING_ROWS} /><Rows rows={GLOBAL_AMENDED_CONTRACTS.map((contract) => ({ label: contract.id, value: contract.responsibility }))} /></Topic>
        <Topic number={5} title="Tool failure"><Rules ids={GLOBAL_LAYER_TOPIC_RULE_IDS.failure} /><Rows rows={GLOBAL_TOOL_FAILURE_ROWS} /></Topic>
        <Topic number={6} title="Consumer contract"><div style={{ color: '#64748b', fontWeight: 800 }}>Adjacent implementation contract — it names required readers; it is not runtime policy.</div><Rows rows={GLOBAL_CONSUMER_CONTRACT} /></Topic>
        <Topic number={7} title={`Enforcement registry (${GLOBAL_ENFORCEMENT_REGISTRY.length} rows)`}><div style={{ display: 'grid', gap: 6 }}>{GLOBAL_ENFORCEMENT_REGISTRY.map((entry) => <article key={entry.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 9px' }}><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontWeight: 800 }}><code>{entry.id}</code><span>{entry.kind}</span><span style={{ borderRadius: 999, padding: '1px 5px', fontSize: 9, ...statusColors[entry.status] }}>{entry.status}</span></div><div>{entry.meaning} <span style={{ color: '#64748b' }}>Owner: {entry.owner}</span></div></article>)}</div><Rows rows={GLOBAL_RETIRED_ENFORCER_MAPPINGS} /></Topic>
        <Topic number={8} title="Canonical enums and data contracts"><Rows rows={GLOBAL_CANONICAL_ENUMS} /><div style={{ display: 'grid', gap: 8 }}>{GLOBAL_RESOLVED_DATA_CONTRACTS.map((contract) => <article key={contract.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 9px' }}><code style={{ fontWeight: 800 }}>{contract.id}</code><div><strong>Producer:</strong> {contract.producer}</div><div><strong>Consumers:</strong> {contract.consumers}</div><div><strong>Shape:</strong> {contract.shape}</div><div><strong>Persistence:</strong> {contract.persistence}</div><div><strong>Invariant:</strong> {contract.invariant}</div></article>)}</div></Topic>
        <Topic number={9} title="Decisions and unresolved governance"><div style={{ display: 'grid', gap: 8 }}>{GLOBAL_DECISIONS.map((decision) => <article key={decision.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 9px' }}><code>{decision.id}</code><div><strong>Question:</strong> {decision.question}</div><div><strong>Decision:</strong> {decision.decision}</div></article>)}</div><Rows rows={GLOBAL_UNRESOLVED_GOVERNANCE} /></Topic>
      </div>
    </section>
  );
}

function SourceOfTruthPanel({ beat }: { beat: FlowBeat }) {
  const entry = ENTRY_BY_ID[beat.id];
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
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{beat.id}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {beat.type}
            {beat.path ? ` · ${PATH_STYLE[beat.path].label}` : ''}
          </div>
          <div style={{ marginTop: 10, lineHeight: 1.45 }}>
            No metadata entry. This is a structural silent beat with no coach copy, script, clip, or
            expected voice response.
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
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{beat.id}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {beat.type}
            {beat.path ? ` · ${PATH_STYLE[beat.path].label}` : ''}
          </div>
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
            <ContextKeyValue
              label="Enforcement"
              value={<EnforcementChips ids={beatEnforcementIds(entry)} />}
            />
            {!entry.expectedResponse &&
              !entry.allowedTools &&
              !beatEnforcementIds(entry).length && <NoneMarker />}
          </div>
        </ContextSection>

        <ContextSection title="Render metadata">
          <ContextRows
            rows={[
              { label: 'Name', value: entry.name },
              { label: 'Order', value: String(entry.order) },
              { label: 'Voice engine', value: entry.voiceEngine },
              { label: 'Voice mode', value: entry.voiceMode ?? 'none' },
              { label: 'Hide orb', value: entry.hideOrb ? 'yes' : 'no' },
              ...(entry.parent ? [{ label: 'Parent beat', value: entry.parent }] : []),
              ...(entry.elements?.length
                ? [{ label: 'Named elements', value: entry.elements.join(', ') }]
                : []),
              ...(entry.spokenContent
                ? [{ label: 'Spoken content', value: entry.spokenContent }]
                : []),
              ...(entry.variable ? [{ label: 'Variable copy', value: 'yes' }] : []),
              ...(entry.openerMode ? [{ label: 'Opener mode', value: entry.openerMode }] : []),
              ...(entry.openerShowsAsBubble !== undefined
                ? [
                    {
                      label: 'Opener shows as bubble',
                      value: entry.openerShowsAsBubble ? 'yes' : 'no',
                    },
                  ]
                : []),
            ]}
          />
          {entry.perElement?.length ? (
            <div style={{ marginTop: 8 }}>
              <ContextTable
                columns={['element', 'line', 'order', 'shows as bubble']}
                rows={entry.perElement.map((item) => [
                  item.elementId,
                  item.line,
                  String(item.order),
                  item.showsAsBubble ? 'yes' : 'no',
                ])}
              />
            </div>
          ) : null}
        </ContextSection>

        <ContextSection title="Section coverage">
          <ContextTable
            columns={['section', 'status']}
            rows={Object.entries(entry.bible?.sectionManifest ?? {}).map(([section, status]) => [
              section,
              typeof status === 'string' ? status : status.na,
            ])}
          />
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
                overflowWrap: 'anywhere',
              }}
            >
              {entry.context}
            </pre>
          ) : (
            <NoneMarker>No coach behavior context</NoneMarker>
          )}
        </ContextSection>

        <ContextSection
          title={`Component inputs${resolvedProps.length ? ` (${resolvedProps.length})` : ''}`}
        >
          {resolvedProps.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {resolvedProps.map(([key, value]) => (
                <ContextKeyValue key={key} label={key} value={value} />
              ))}
            </div>
          ) : (
            <NoneMarker>No explicit props</NoneMarker>
          )}
        </ContextSection>

        <ContextSection title="Identity">
          {entry.bible?.identity ? (
            <>
              <ContextRows
                rows={entry.bible.identity.rows}
                watchOut={entry.bible.identity.watchOut}
                enforcedBy={entry.bible.identity.enforcedBy}
                status={entry.bible.identity.status}
              />
              <div style={{ marginTop: 8 }}>
                <ContextSubheading>Aliases</ContextSubheading>
                <div style={{ marginTop: 6 }}>
                  <ContextTable
                    columns={['surface', 'value']}
                    rows={entry.bible.identity.aliases.map((alias) => [alias.surface, alias.value])}
                  />
                </div>
              </div>
            </>
          ) : (
            <NoneMarker />
          )}
        </ContextSection>

        <ContextSection title="Components">
          {entry.bible?.components ? (
            <ContextRows
              rows={entry.bible.components.rows}
              watchOut={entry.bible.components.watchOut}
              enforcedBy={entry.bible.components.enforcedBy}
              status={entry.bible.components.status}
            />
          ) : (
            <NoneMarker />
          )}
        </ContextSection>

        <ContextSection title="Voice">
          {entry.bible?.voice ? (
            <>
              <ContextRows
                rows={entry.bible.voice.rows}
                watchOut={entry.bible.voice.assertion}
                enforcedBy={entry.bible.voice.enforcedBy}
                status={entry.bible.voice.status}
              />
              <div style={{ marginTop: 8 }}>
                <ContextTable
                  columns={['script line', 'resolves to', 'live allowed']}
                  rows={entry.bible.voice.perLine.map((line) => [
                    String(line.seq),
                    line.resolvesTo,
                    line.liveAllowed,
                  ])}
                />
              </div>
            </>
          ) : (
            <NoneMarker />
          )}
        </ContextSection>

        <ContextSection title="Context prose">
          {entry.bible?.contextProse ? (
            <ContextRows
              rows={[{ label: 'Prose', value: entry.bible.contextProse.prose }]}
              enforcedBy={entry.bible.contextProse.enforcedBy}
              status={entry.bible.contextProse.status}
              pending={entry.bible.contextProse.pending}
            />
          ) : (
            <NoneMarker />
          )}
        </ContextSection>

        <ContextSection title="Persistence">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entry.bible?.persistence && (
              <ContextRows
                rows={entry.bible.persistence.rows}
                watchOut={entry.bible.persistence.watchOut}
                enforcedBy={entry.bible.persistence.enforcedBy}
                status={entry.bible.persistence.status}
              />
            )}
            <ContextSubheading>Data in</ContextSubheading>
            <ContextTable
              columns={['key', 'from', 'written by', 'table / column', 'note']}
              rows={(entry.io?.dataIn ?? []).map((datum) => [
                datum.key,
                datum.from,
                datum.writtenBy,
                datum.persistsTo,
                datum.note,
              ])}
            />
            <ContextSubheading>Data out</ContextSubheading>
            <ContextTable
              columns={['key', 'from', 'written by', 'table / column', 'note']}
              rows={(entry.io?.dataOut ?? []).map((datum) => [
                datum.key,
                datum.from,
                datum.writtenBy,
                datum.persistsTo,
                datum.note,
              ])}
            />
          </div>
        </ContextSection>

        <ContextSection title="Tools">
          {entry.bible?.allowedTools ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ContextKeyValue
                label="Allowed"
                value={entry.bible.allowedTools.tools.join(', ') || <NoneMarker />}
              />
              <ContextKeyValue label="Call rules" value={entry.bible.allowedTools.callRules} />
              {entry.bible.allowedTools.note && (
                <ContextKeyValue label="Note" value={entry.bible.allowedTools.note} />
              )}
              {entry.bible.allowedTools.status && (
                <ContextKeyValue label="Source status" value={entry.bible.allowedTools.status} />
              )}
              {entry.bible.allowedTools.enforcedBy.length ? (
                <ContextKeyValue
                  label="Enforced by"
                  value={entry.bible.allowedTools.enforcedBy.join(', ')}
                />
              ) : null}
              <ContextTable
                columns={['tool', 'argument schema', 'when']}
                rows={entry.bible.allowedTools.specs.map((spec) => [
                  spec.tool,
                  spec.args,
                  spec.when,
                ])}
              />
            </div>
          ) : (
            <NoneMarker />
          )}
        </ContextSection>

        <ContextSection title={`Script detail (${entry.script.length})`}>
          {entry.script.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {entry.script.map((line) => {
                const timing = entry.bible?.scriptMeta?.rows.find((row) => row.seq === line.seq);
                const voice = entry.bible?.voice?.perLine.find((row) => row.seq === line.seq);
                return (
                  <div key={line.seq} style={{ borderTop: '1px solid #eef2f7', paddingTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#475569' }}>
                      Line {line.seq}
                    </div>
                    <div
                      style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.45, color: '#334155' }}
                    >
                      {line.words || <NoneMarker>silent reveal</NoneMarker>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 7 }}>
                      <ContextKeyValue
                        label="Reveal gate"
                        value={timing?.reveal ?? <NoneMarker />}
                      />
                      <ContextKeyValue label="Timing" value={timing?.timing ?? <NoneMarker />} />
                      <ContextKeyValue
                        label="Voice resolution"
                        value={
                          voice?.resolvesTo ??
                          (line.clip ? `recorded clip ${line.clip}` : <NoneMarker />)
                        }
                      />
                      <ContextKeyValue
                        label="Live allowed"
                        value={voice?.liveAllowed ?? <NoneMarker />}
                      />
                      <ContextKeyValue
                        label="Interruptible"
                        value={
                          line.interruptible === undefined ? (
                            <NoneMarker>default</NoneMarker>
                          ) : line.interruptible ? (
                            'yes'
                          ) : (
                            'no'
                          )
                        }
                      />
                    </div>
                  </div>
                );
              })}
              {entry.bible?.scriptMeta && (
                <ContextRows
                  rows={[]}
                  enforcedBy={entry.bible.scriptMeta.enforcedBy}
                  status={entry.bible.scriptMeta.status}
                />
              )}
            </div>
          ) : (
            <NoneMarker />
          )}
        </ContextSection>

        <ContextSection title="Conversation">
          {entry.bible?.conversation ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ContextKeyValue label="Opens" value={entry.bible.conversation.opens} />
              <ContextKeyValue
                label="Max turns"
                value={String(entry.bible.conversation.maxTurns)}
              />
              <ContextKeyValue label="On max turns" value={entry.bible.conversation.onMaxTurns} />
              {entry.bible.conversation.responseTimeMs !== undefined && (
                <ContextKeyValue
                  label="Response time"
                  value={`${entry.bible.conversation.responseTimeMs} ms`}
                />
              )}
              {entry.bible.conversation.endpointPatienceMs !== undefined && (
                <ContextKeyValue
                  label="Endpoint patience"
                  value={`${entry.bible.conversation.endpointPatienceMs} ms`}
                />
              )}
              {entry.bible.conversation.bargeInPolicy !== undefined && (
                <ContextKeyValue
                  label="Barge-in policy"
                  value={entry.bible.conversation.bargeInPolicy}
                />
              )}
              {entry.bible.conversation.turnDetection !== undefined && (
                <ContextKeyValue
                  label="Turn detection"
                  value={entry.bible.conversation.turnDetection}
                />
              )}
              {entry.bible.conversation.smartTurnCompletionThreshold !== undefined && (
                <ContextKeyValue
                  label="Smart turn completion"
                  value={String(entry.bible.conversation.smartTurnCompletionThreshold)}
                />
              )}
              {entry.bible.conversation.maxSilenceBeforeRepromptMs !== undefined && (
                <ContextKeyValue
                  label="Max silence before reprompt"
                  value={`${entry.bible.conversation.maxSilenceBeforeRepromptMs} ms`}
                />
              )}
              {entry.bible.conversation.maxTurnLengthMs !== undefined && (
                <ContextKeyValue
                  label="Max turn length"
                  value={`${entry.bible.conversation.maxTurnLengthMs} ms`}
                />
              )}
              {entry.bible.conversation.sttLanguageHints !== undefined && (
                <ContextKeyValue
                  label="STT language hints"
                  value={entry.bible.conversation.sttLanguageHints.join(', ')}
                />
              )}
              {entry.bible.conversation.sttVocabulary !== undefined && (
                <ContextKeyValue
                  label="STT vocabulary"
                  value={entry.bible.conversation.sttVocabulary.join(', ')}
                />
              )}
              {entry.bible.conversation.ttsVoiceId !== undefined && (
                <ContextKeyValue label="TTS voice ID" value={entry.bible.conversation.ttsVoiceId} />
              )}
              <ContextTable
                columns={['on', 'reply', 'then', 'voice']}
                rows={entry.bible.conversation.branches.map((branch) => [
                  branch.on,
                  branch.reply,
                  branch.then,
                  branch.voice,
                ])}
              />
            </div>
          ) : (
            <NoneMarker />
          )}
        </ContextSection>

        <ContextSection title="Acceptance">
          {entry.bible?.acceptance ? (
            <>
              <ContextTable
                columns={['criterion', 'method']}
                rows={entry.bible.acceptance.rows.map((row) => [
                  row.criterion,
                  <div
                    key={`${row.criterion}-${row.check}`}
                    style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}
                  >
                    <span
                      style={{
                        border: '1px solid #cbd5e1',
                        borderRadius: 999,
                        color: '#475569',
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: '0.03em',
                        padding: '2px 5px',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.check}
                    </span>
                    {row.pendingBackendWiring && (
                      <span
                        style={{
                          background: '#fef3c7',
                          border: '1px solid #f59e0b',
                          borderRadius: 999,
                          color: '#92400e',
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: '0.03em',
                          padding: '2px 5px',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        PENDING-BACKEND-WIRING
                      </span>
                    )}
                  </div>,
                ])}
              />
              <div style={{ marginTop: 8 }}>
                <ContextRows
                  rows={[]}
                  enforcedBy={entry.bible.acceptance.enforcedBy}
                  status={entry.bible.acceptance.status}
                />
              </div>
            </>
          ) : (
            <NoneMarker />
          )}
        </ContextSection>

        <ContextSection title="Flow">
          {entry.bible?.flow ? (
            <ContextRows
              rows={entry.bible.flow.rows}
              enforcedBy={entry.bible.flow.enforcedBy}
              status={entry.bible.flow.status}
            />
          ) : (
            <NoneMarker />
          )}
        </ContextSection>

        <ContextSection title="Edges">
          {entry.bible?.edges ? (
            <>
              <ContextTable
                columns={['edge', 'behavior', 'voice']}
                rows={entry.bible.edges.rows.map((row) => [row.edge, row.behavior, row.voice])}
              />
              <div style={{ marginTop: 8 }}>
                <ContextRows
                  rows={[]}
                  enforcedBy={entry.bible.edges.enforcedBy}
                  status={entry.bible.edges.status}
                />
              </div>
            </>
          ) : (
            <NoneMarker />
          )}
        </ContextSection>

        <ContextSection title="Applicable decisions">
          {entry.bible?.applicableDecisions ? (
            <>
              <ContextTable
                columns={['decision', 'binds', 'how']}
                rows={entry.bible.applicableDecisions.rows.map((row) => [
                  row.decision,
                  row.binds ? 'yes' : 'no',
                  row.how,
                ])}
              />
              <div style={{ marginTop: 8 }}>
                <ContextRows
                  rows={[]}
                  enforcedBy={entry.bible.applicableDecisions.enforcedBy}
                  status={entry.bible.applicableDecisions.status}
                />
              </div>
            </>
          ) : (
            <NoneMarker />
          )}
        </ContextSection>

        <ContextSection title="Rules">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ContextSubheading>Context rules</ContextSubheading>
            <ContextTable
              columns={['id', 'severity', 'rule', 'enforced by']}
              rows={(entry.bible?.rulesContext ?? []).map((rule) => [
                rule.id,
                rule.severity,
                rule.rule,
                <EnforcementChips ids={rule.enforcedBy} />,
              ])}
            />
            <ContextSubheading>Code rules</ContextSubheading>
            <ContextTable
              columns={['id', 'severity', 'rule', 'enforced by']}
              rows={(entry.bible?.rulesCode ?? []).map((rule) => [
                rule.id,
                rule.severity,
                rule.rule,
                <EnforcementChips ids={rule.enforcedBy} />,
              ])}
            />
          </div>
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

function ScriptPanel({ id, showExpectedUser }: { id?: string; showExpectedUser: boolean }) {
  const entry = id ? ENTRY_BY_ID[id] : undefined;

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
                {line.verbatim !== undefined && (
                  <span style={{ fontSize: 10.5, color: '#64748b' }}>
                    verbatim: {line.verbatim ? 'yes' : 'no'}
                  </span>
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
  type: string;
  props?: Record<string, string>;
  engine: VoiceEngine;
  mode: VoiceMode;
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
// mode, path, hideOrb, and structural props all come from there, so
// the render has a single authored store.
export const BASE_BEATS: FlowBeat[] = BEATS_SOURCE.map((b) => ({
  id: b.id,
  type: b.type,
  props: b.props ?? undefined,
  engine: b.voiceEngine,
  mode: b.voiceMode,
  path: b.path,
  hideOrb: b.hideOrb || undefined,
  script: b.script,
}));

export const BEATS: FlowBeat[] = BASE_BEATS.map((beat) => ({
  ...beat,
  props: {
    ...(beat.props ?? {}),
    ...metadataPropsForBeat(beat.type, beat.id),
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
    type: 'coach-bubble',
    props: {
      text: "Energy a little low, that makes sense. Sleep was short. Let's keep today light and focused.",
    },
    engine: 'Cartesia',
    mode: 'Improvise',
  },
  {
    id: 'morning-are-you-done',
    type: 'coach-bubble',
    props: {
      text: 'Looks like there are a few items left. Want to add anything, or should we move on?',
    },
    engine: 'MP3',
    mode: 'Verbatim',
  },
  {
    id: 'morning-wrap',
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
    type: 'coach-bubble',
    props: { text: 'Hey, good evening. Here are your habits for today. How did the day go?' },
    engine: 'MP3',
    mode: 'Verbatim',
  },
  {
    id: 'evening-habit-review',
    type: 'habit-review',
    engine: 'Silent',
    mode: null,
  },
  {
    id: 'evening-habits-reaction',
    type: 'coach-bubble',
    props: { text: "Two out of three, that's solid. The screens one is hard. We'll work on that." },
    engine: 'Cartesia',
    mode: 'Improvise',
  },
  {
    id: 'evening-are-you-done',
    type: 'coach-bubble',
    props: {
      text: 'Looks like there are a few items left. Want to add anything, or should we move on?',
    },
    engine: 'MP3',
    mode: 'Verbatim',
  },
  {
    id: 'evening-reflection',
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
    type: 'coach-bubble',
    props: { text: "That's real. Hold onto the gratitude tonight." },
    engine: 'Cartesia',
    mode: 'Improvise',
  },
  {
    id: 'evening-wrap',
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

// A single self-contained phone: the iOS-style status bar followed directly by
// the real app screen. Annotation controls deliberately live in the outside rail,
// never inside the faithful app preview. The orb is `paused` so a wall of them
// settles into its look then freezes, instead of running many perpetual loops.
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
  onRequestPlay,
  onDone,
}: {
  beat: FlowBeat;
  active: boolean;
  onRequestPlay: (id: string | null) => void;
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

// A colon suffix identifies a runtime variation of the same logical beat. Keep
// that relationship in the render rather than letting a long run of variants
// look like unrelated screens.
function baseBeatId(id: string): string {
  return id.split(':', 1)[0];
}

interface BeatGroup {
  baseId: string;
  firstIndex: number;
  base?: { beat: FlowBeat; index: number };
  variants: { beat: FlowBeat; index: number }[];
}

function groupBeats(beats: FlowBeat[]): BeatGroup[] {
  const byBaseId = new Map<string, BeatGroup>();
  for (const [index, beat] of beats.entries()) {
    const baseId = baseBeatId(beat.id);
    const group = byBaseId.get(baseId) ?? { baseId, firstIndex: index, variants: [] };
    if (beat.id === baseId) {
      group.base = { beat, index };
    } else {
      group.variants.push({ beat, index });
    }
    byBaseId.set(baseId, group);
  }
  return [...byBaseId.values()];
}

// Shared phone frame renderer. Each beat renders in its OWN phone card, with the
// source-of-truth rail in the left margin on the Onboarding tab. Variants stay
// nested under their base id and are collapsed by default.
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

  const beatRow = (b: FlowBeat, i: number) => {
    const branched = b.path === 'beginner' || b.path === 'advanced';
    const isStart = branched && b.path !== beats[i - 1]?.path;
    const isEnd = branched && b.path !== beats[i + 1]?.path;
    return (
      <div key={b.id} data-beat-id={b.id} style={{ marginBottom: 34 }}>
        {showWords && <BeatDivider n={beatNumberFromId(b.id, i)} />}
        {showWords && isStart && <PathBanner path={b.path} edge="start" />}
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {/* Left rail: compact voice tag on non-onboarding tabs, full metadata
              panel on the onboarding tab. */}
          <div
            style={{
              flex: `0 0 ${TAG_COL_W}px`,
              paddingRight: TAG_GAP,
              paddingTop: showWords ? 8 : 96,
            }}
          >
            {showWords ? (
              <SourceOfTruthPanel beat={b} />
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <VoiceTag engine={b.engine} mode={b.mode} />
              </div>
            )}
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                justifyContent: showWords ? 'flex-start' : 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => onRequestPlay(playingId === b.id ? null : b.id)}
                title={playingId === b.id ? 'Stop this beat' : 'Play this beat'}
                aria-label={playingId === b.id ? 'Stop this beat' : 'Play this beat'}
                style={{
                  minHeight: 28,
                  borderRadius: 999,
                  border: `1px solid ${playingId === b.id ? '#fecaca' : '#93c5fd'}`,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  background: playingId === b.id ? '#fef2f2' : '#eff6ff',
                  color: playingId === b.id ? '#dc2626' : '#1d4ed8',
                  fontSize: 11,
                  fontWeight: 800,
                  fontFamily: 'Urbanist, -apple-system, sans-serif',
                }}
              >
                <Icon icon={playingId === b.id ? 'mdi:stop' : 'mdi:play'} width={14} height={14} />
                {playingId === b.id ? 'STOP' : 'PLAY'}
              </button>
            </div>
          </div>
          {/* Phone column: a self-contained phone with the orb, playable in place. */}
          <div style={{ flex: `0 0 ${PHONE_W}px` }}>
            <PlayableBeat
              beat={b}
              active={playingId === b.id}
              onRequestPlay={onRequestPlay}
              onDone={() => onRequestPlay(null)}
            />
          </div>
          {showWords && (
            <div style={{ flex: `0 0 ${WORDS_COL_W}px`, marginLeft: WORDS_GAP, paddingTop: 8 }}>
              <ScriptPanel id={b.id} showExpectedUser={showExpectedUser} />
            </div>
          )}
        </div>
        {showWords && isEnd && <PathBanner path={b.path} edge="end" />}
      </div>
    );
  };

  const groupedRows = groupBeats(beats).map((group) => {
    if (group.variants.length === 0) {
      // A singleton is still a normal beat row.
      return group.base ? beatRow(group.base.beat, group.base.index) : null;
    }
    return (
      <VariantBeatGroup
        key={group.baseId}
        group={group}
        renderBeat={beatRow}
        showWords={showWords}
      />
    );
  });

  return (
    <div style={{ width: frameWidth, maxWidth: '100%', margin: '0 auto' }}>
      {/* Per-beat rows. The source-of-truth rail (left) and the phone (right) are
          top-aligned in one row. A path banner sits above the row when the beat
          starts a path branch. */}
      {groupedRows}
    </div>
  );
}

function VariantBeatGroup({
  group,
  renderBeat,
  showWords,
}: {
  group: BeatGroup;
  renderBeat: (beat: FlowBeat, index: number) => ReactNode;
  showWords: boolean;
}) {
  const [open, setOpen] = useState(false);
  const beatNumber = beatNumberFromId(group.baseId, group.firstIndex);
  return (
    <section
      data-beat-group-id={group.baseId}
      data-variant-count={group.variants.length}
      data-variants-collapsed={!open}
      style={{ marginBottom: 34 }}
    >
      {group.base
        ? renderBeat(group.base.beat, group.base.index)
        : showWords && <BeatDivider n={beatNumber} />}
      <button
        type="button"
        aria-controls={`${group.baseId}-variants`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          border: '1px solid #cbd5e1',
          borderRadius: 12,
          background: '#eef2f7',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontFamily: 'Urbanist, -apple-system, sans-serif',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 16, color: '#475569' }}>
          {open ? '▾' : '▸'}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
          Beat {beatNumber} variants
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#3730a3' }}>
          {group.variants.length} {open ? 'hide' : 'show'}
        </span>
      </button>
      {open && (
        <div
          id={`${group.baseId}-variants`}
          data-beat-variants={group.baseId}
          style={{ marginTop: 20 }}
        >
          {group.variants.map(({ beat, index }) => renderBeat(beat, index))}
        </div>
      )}
    </section>
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
          <>
            <GlobalContextPanel />
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
          </>
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
