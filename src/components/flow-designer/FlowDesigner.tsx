import { Icon } from '@iconify/react';
import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AnimationsCtx,
  PlayingCtx,
  RevealCtx,
  SpokenWordsCtx,
  StepRevealCtx,
  type BeatDef,
} from './beatKit';
import { BEAT_DEFS } from './beats';
import { COACH_BG } from './beats/_beatStyle';
import { kindOf, raf, runBeatNarration, runBeatScript, sample, stopSpeech } from './beatNarration';
import { FlowStateCtx, type FlowState, type HabitScheduleCfg } from './flowStateCtx';
import { Orb } from '@/components/orb/Orb';
import { orbSpeaking } from '@/components/orb/orbView';
import {
  BEATS_SOURCE,
  BEAT_BY_ID,
  BEAT_BY_SCREEN_ID,
  FLOWS_SOURCE,
  GLOBAL_RULES,
  type BeatEntry,
  type BeatRule,
  type BeatRules,
  type FlowEntry,
  type ScriptLine,
} from './beatsSource';

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
const REGISTRY_MAP: Record<string, BeatDef> = Object.fromEntries(
  BEAT_DEFS.map((d) => [d.type, d]),
);

// --- Onboarding words metadata ---
// Derived from the ONE source (beatsSource.ts). The render reads that single
// authored store; this back-compat view exposes the legacy meta shape the play
// driver (runBeatNarration) and the metadata panels already consume, so the
// consolidation kept exactly one hand-authored store with no behavior change.
interface BeatElementMeta {
  elementId: string;
  line: string;
  order: number;
  showsAsBubble: boolean;
}
interface BeatMeta {
  screenId: string;
  engine: 'MP3' | 'Cartesia' | 'Vapi' | 'Silent';
  scripted: boolean | null;
  variable: boolean;
  variableNote?: string;
  opener: string | null;
  secondBubble?: string | null;
  closeBubble?: string | null;
  confirmBubble?: string | null;
  buttonLabel?: string | null;
  openerMode?: string;
  openerShowsAsBubble?: boolean;
  expectedResponse: string;
  clipReuse?: string;
  clipNote?: string;
  // Optional segmented narration: one flowing read where some segments reveal a
  // card row as they are spoken (the meshed clips), so nothing is said twice.
  narration?: { say: string; reveal?: number; clip?: string; bubble?: number; audioSrc?: string }[];
  elements: BeatElementMeta[];
}

function legacyMetaOf(entry: BeatEntry): BeatMeta | null {
  if (!entry.legacy || !entry.screenId) return null;
  const l = entry.legacy;
  return {
    screenId: entry.screenId,
    engine: l.engine as BeatMeta['engine'],
    scripted: l.scripted,
    variable: l.variable,
    variableNote: l.variableNote ?? undefined,
    opener: l.opener,
    secondBubble: l.secondBubble ?? undefined,
    closeBubble: l.closeBubble ?? undefined,
    confirmBubble: l.confirmBubble ?? undefined,
    buttonLabel: l.buttonLabel ?? undefined,
    openerMode: l.openerMode ?? undefined,
    openerShowsAsBubble: l.openerShowsAsBubble ?? undefined,
    expectedResponse: entry.expectedResponse ?? '',
    clipNote: l.clipNote ?? undefined,
    narration: l.narration ? l.narration.map((s) => ({ ...s })) : undefined,
    elements: l.elements.map((e) => ({ ...e })),
  };
}

export const METADATA_BY_SCREEN_ID: Record<string, BeatMeta> = Object.fromEntries(
  BEATS_SOURCE.map((b) => [b.screenId, legacyMetaOf(b)]).filter(
    (pair): pair is [string, BeatMeta] => Boolean(pair[0] && pair[1]),
  ),
);

// Fast lookup of the full one-source entry (for the script list + context panel).
const ENTRY_BY_SCREEN_ID = BEAT_BY_SCREEN_ID;

function sortedElements(meta?: BeatMeta): BeatElementMeta[] {
  return meta?.elements ? [...meta.elements].sort((a, b) => a.order - b.order) : [];
}

function bubbleLines(meta?: BeatMeta): string[] {
  return (meta?.narration ?? [])
    .filter((seg) => seg.bubble != null && seg.say)
    .map((seg) => seg.say);
}

function metadataPropsForBeat(type: string, screenId?: string): Record<string, string> {
  if (!screenId) return {};
  const meta = METADATA_BY_SCREEN_ID[screenId];
  if (!meta) return {};

  const bubbles = bubbleLines(meta);
  const elements = sortedElements(meta);

  switch (type) {
    case 'profile-beat':
      return {
        greeting: meta.opener ?? '',
        askAge: elements.find((element) => element.elementId === 'age')?.line ?? elements[0]?.line ?? '',
        askGender:
          elements.find((element) => element.elementId === 'gender')?.line ?? elements[1]?.line ?? '',
      };
    case 'advanced-capture':
      return {
        coachLine: meta.opener ?? '',
        closeCoachLine: meta.closeBubble ?? bubbles[1] ?? '',
      };
    case 'advanced-frequency':
      return {
        coachLine: meta.opener ?? '',
        coachLine2: meta.secondBubble ?? bubbles[1] ?? '',
        confirmCoachLine: meta.confirmBubble ?? bubbles[bubbles.length - 1] ?? '',
      };
    case 'into-app':
      return {
        coachLine: meta.opener ?? '',
        buttonLabel: meta.buttonLabel ?? 'Approve and start',
      };
    case 'state-check':
    case 'morning-checkin-setup':
    case 'reflection-card':
    case 'habit-schedule':
      return {
        coachLine: meta.opener ?? '',
        coachLine2: meta.secondBubble ?? bubbles[1] ?? '',
      };
    case 'mic-permission':
    case 'path-selection':
    case 'category-grid':
    case 'goals-list':
    case 'habit-picker':
    case 'custom-entry':
    case 'weekly-projection':
      return { coachLine: meta.opener ?? '' };
    default:
      return {};
  }
}

// --- Isolated per-beat flow-state provider ---
// A fresh, scoped FlowState for one beat, so beats can stack in one scroll
// without sharing a global active-beat state. Mirrors the flowState object
// FlowBuilder builds for its Play pane (flowStateCtx.ts shape), seeded with
// light demo values so each beat looks interactive on its own.
function useIsolatedFlowState(): FlowState {
  const [path, setPath] = useState<'new' | 'exp' | null>('new');
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
  const flowState = useIsolatedFlowState();

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

const ENGINE_STYLE: Record<VoiceEngine, { bg: string; text: string; border: string; icon: string }> =
  {
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

// A thin divider plus the beat number, name, and play control above each beat.
// The play control stays outside the rendered phone, so the phone itself remains
// a clean visual QA mirror of the app screen.
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
              fontSize: 11,
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
            flexShrink: 0,
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

function RuleBadge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'danger' | 'ok' }) {
  const style =
    tone === 'danger'
      ? { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' }
      : tone === 'ok'
        ? { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' }
        : { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 7px',
        borderRadius: 99,
        border: `1px solid ${style.border}`,
        background: style.bg,
        color: style.text,
        fontSize: 10,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function RuleRow({ rule }: { rule: BeatRule }) {
  const unenforced = rule.severity === 'must' && rule.enforcedBy == null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
        <RuleBadge label={rule.severity} tone={rule.severity === 'must' ? 'danger' : 'neutral'} />
        <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.45, color: '#1e293b' }}>{rule.rule}</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 54 }}>
        <RuleBadge label={rule.enforcedBy ?? 'unenforced'} tone={unenforced ? 'danger' : 'ok'} />
        {unenforced && <RuleBadge label="red flag" tone="danger" />}
        <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{rule.id}</span>
      </div>
    </div>
  );
}

function RuleList({ title, rules }: { title: string; rules: readonly BeatRule[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: '#64748b',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
      {rules.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: '#94a3b8' }}>No rules in this section.</div>
      )}
    </div>
  );
}

function RulesPanel({ rules }: { rules?: BeatRules }) {
  return (
    <ContextSection title="Rules" defaultOpen>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#0f172a' }}>
            Inherited global rules
          </div>
          <RuleList title="Context" rules={GLOBAL_RULES.context} />
          <RuleList title="Code" rules={GLOBAL_RULES.code} />
        </div>
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#0f172a' }}>
            Beat rules
          </div>
          {rules ? (
            <>
              <RuleList title="Context" rules={rules.context} />
              <RuleList title="Code" rules={rules.code} />
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: '#94a3b8' }}>
              No beat-specific rules authored on this beat yet.
            </div>
          )}
        </div>
      </div>
    </ContextSection>
  );
}

function FlowValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: '#94a3b8',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.5, color: '#1e293b' }}>{children}</div>
    </div>
  );
}

function FlowPre({ text }: { text: string }) {
  const isTodo = text.includes('TODO:');
  return (
    <pre
      style={{
        margin: 0,
        whiteSpace: 'pre-wrap',
        background: isTodo ? '#fff7ed' : '#f8fafc',
        border: `1px solid ${isTodo ? '#fed7aa' : '#e2e8f0'}`,
        borderRadius: 10,
        padding: '10px 12px',
        fontSize: 12,
        lineHeight: 1.5,
        color: isTodo ? '#9a3412' : '#334155',
        fontFamily: 'Urbanist, -apple-system, sans-serif',
      }}
    >
      {text}
    </pre>
  );
}

function InlineList({ items }: { items: readonly string[] }) {
  return items.length ? (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((item) => (
        <RuleBadge key={item} label={item} tone={item.startsWith('TODO:') ? 'danger' : 'neutral'} />
      ))}
    </div>
  ) : (
    <span style={{ color: '#94a3b8' }}>None</span>
  );
}

function FlowLayerPanel({ flow }: { flow?: FlowEntry }) {
  if (!flow) {
    return (
      <details
        style={{
          maxWidth: 980,
          margin: '0 auto 20px',
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          padding: '14px 16px',
        }}
      >
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 900, color: '#0f172a' }}>
          Flow layer
        </summary>
        <div style={{ marginTop: 10, fontSize: 12.5, color: '#94a3b8' }}>
          No flow-layer entry authored for this tab yet.
        </div>
      </details>
    );
  }

  const todoValues = [
    flow.systemPrompt,
    flow.vapiAgent?.firstMessage,
    flow.vapiAgent?.model,
    flow.vapiAgent?.voice,
    flow.vapiAgent?.serverUrl,
    flow.vapiAgent?.transcriber,
  ].filter((value): value is string => Boolean(value && value.includes('TODO:')));

  return (
    <details
      open
      style={{
        maxWidth: 980,
        margin: '0 auto 20px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}
    >
      <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 900, color: '#0f172a' }}>
        Flow layer: {flow.name}
      </summary>
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
        {todoValues.length > 0 && (
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              color: '#9a3412',
              fontSize: 12.5,
              fontWeight: 800,
            }}
          >
            TODO flagged: final copy or dashboard-only assistant fields are not present in the render yet.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <FlowValue label="Identity">
            {flow.id} · order {flow.order}
          </FlowValue>
          <FlowValue label="Engines">
            <InlineList items={flow.engines} />
          </FlowValue>
          <FlowValue label="Entry">{flow.entry}</FlowValue>
          <FlowValue label="Exit">{flow.exit}</FlowValue>
        </div>
        <FlowValue label="Description">{flow.description}</FlowValue>
        <FlowValue label="System prompt">
          <FlowPre text={flow.systemPrompt} />
        </FlowValue>
        <ContextSection title="Flow rules" defaultOpen>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#0f172a' }}>Inherited global rules</div>
              <RuleList title="Context" rules={GLOBAL_RULES.context} />
              <RuleList title="Code" rules={GLOBAL_RULES.code} />
            </div>
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#0f172a' }}>Flow rules</div>
              <RuleList title="Context" rules={flow.flowRules.context} />
              <RuleList title="Code" rules={flow.flowRules.code} />
            </div>
          </div>
        </ContextSection>
        {flow.vapiAgent && (
          <ContextSection title="Vapi agent" defaultOpen>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <FlowValue label="First message">{flow.vapiAgent.firstMessage}</FlowValue>
              <FlowValue label="Model">{flow.vapiAgent.model}</FlowValue>
              <FlowValue label="Voice">{flow.vapiAgent.voice}</FlowValue>
              <FlowValue label="Transcriber">{flow.vapiAgent.transcriber}</FlowValue>
              <FlowValue label="Server URL">{flow.vapiAgent.serverUrl}</FlowValue>
              <FlowValue label="Drives beats">
                <InlineList items={flow.vapiAgent.drivesBeats} />
              </FlowValue>
            </div>
            <div style={{ marginTop: 12 }}>
              <FlowValue label="Agent system prompt">
                <FlowPre text={flow.vapiAgent.systemPrompt} />
              </FlowValue>
            </div>
            <div style={{ marginTop: 12 }}>
              <FlowValue label="Tools">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {flow.vapiAgent.tools.map((tool) => (
                    <div key={tool.name} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <RuleBadge label={tool.name} tone="ok" />
                        <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{tool.id ?? 'no id'}</span>
                        <span style={{ fontSize: 10.5, color: '#64748b' }}>{tool.screen}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#475569' }}>{tool.description}</div>
                    </div>
                  ))}
                </div>
              </FlowValue>
            </div>
          </ContextSection>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <FlowValue label="Tools">
            <InlineList items={flow.tools} />
          </FlowValue>
          <FlowValue label="Data">
            <InlineList items={flow.data} />
          </FlowValue>
        </div>
      </div>
    </details>
  );
}

function SourceOfTruthPanel({ beat }: { beat: FlowBeat }) {
  const meta = beat.screenId ? METADATA_BY_SCREEN_ID[beat.screenId] : undefined;
  const entry = BEAT_BY_ID[beat.id] ?? (beat.screenId ? ENTRY_BY_SCREEN_ID[beat.screenId] : undefined);
  const metaElements = meta ? sortedElements(meta) : [];
  const narration = meta?.narration ?? [];
  const resolvedProps = beat.props ? Object.entries(beat.props) : [];

  if (!meta) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'Urbanist, -apple-system, sans-serif' }}>
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
            No metadata entry. This is a structural silent beat with no coach copy, narration, clip, or expected voice response.
          </div>
          <div style={{ marginTop: 12 }}>
            <RulesPanel rules={entry?.rules} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'Urbanist, -apple-system, sans-serif' }}>
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
          {beat.screenId && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              Screen ID: {beat.screenId}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <WordsFlagChip label={meta.engine} tone="engine" />
          {beat.mode && <WordsFlagChip label={beat.mode} tone="note" />}
          {meta.variable && (
            <WordsFlagChip
              label={`live${meta.variableNote ? `, ${meta.variableNote.split(',')[0]}` : ', name'}`}
              tone="live"
            />
          )}
          {meta.openerShowsAsBubble === false && meta.opener && <WordsFlagChip label="opener hidden" tone="note" />}
        </div>

        <ContextSection title="Beat metadata" defaultOpen>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ContextKeyValue label="Expected response" value={meta.expectedResponse} />
            {entry?.allowedTools && <ContextKeyValue label="Allowed tools" value={entry.allowedTools} />}
            {meta.clipNote && <ContextKeyValue label="Clip note" value={meta.clipNote} />}
            {meta.variableNote && <ContextKeyValue label="Variable note" value={meta.variableNote} />}
            {meta.openerMode && <ContextKeyValue label="Opener mode" value={meta.openerMode} />}
          </div>
        </ContextSection>

        <RulesPanel rules={entry?.rules} />

        <ContextSection title={entry?.context ? 'Coach behavior context' : 'Coach behavior context (none)'}>
          {entry?.context ? (
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
              No coach behavior context for this beat (structural or newer beat, not yet in screen_contexts).
            </div>
          )}
        </ContextSection>

        <ContextSection title="Copy">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ContextKeyValue
              label="Opener"
              value={meta.opener || 'No opener, this beat starts with rendered elements.'}
            />
            {meta.secondBubble && <ContextKeyValue label="Second bubble" value={meta.secondBubble} />}
            {meta.closeBubble && <ContextKeyValue label="Close bubble" value={meta.closeBubble} />}
            {meta.confirmBubble && <ContextKeyValue label="Confirm bubble" value={meta.confirmBubble} />}
            {meta.buttonLabel && <ContextKeyValue label="Button label" value={meta.buttonLabel} />}
          </div>
        </ContextSection>

        <ContextSection title={`Narration${narration.length ? ` (${narration.length})` : ''}`}>
          {narration.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {narration.map((seg, idx) => {
                const metaBits = [
                  seg.bubble != null ? `bubble ${seg.bubble}` : null,
                  seg.reveal != null ? `reveal ${seg.reveal}` : null,
                  seg.clip ? `clip ${seg.clip}` : null,
                  seg.audioSrc ?? null,
                ].filter(Boolean);
                return (
                  <div key={`${beat.id}-seg-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                      {idx + 1}. {metaBits.join(' · ') || 'timing only'}
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.45, color: '#1e293b' }}>
                      {seg.say || '(silent reveal)'}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: '#94a3b8' }}>No narration array on this beat.</div>
          )}
        </ContextSection>

        <ContextSection title={`Beat elements${metaElements.length ? ` (${metaElements.length})` : ''}`}>
          {metaElements.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {metaElements.map((el) => (
                <div key={el.elementId} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                    {el.order}. {el.elementId}
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.45, color: '#1e293b' }}>{el.line}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: '#94a3b8' }}>No beat elements on this beat.</div>
          )}
        </ContextSection>

        <ContextSection title={`Resolved props${resolvedProps.length ? ` (${resolvedProps.length})` : ''}`}>
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
      </div>
    </div>
  );
}

// --- Script panel (right column) ---
// The ordered script list from the ONE source: the exact lines the engine plays
// and runs, in order. Per line: seq, words, the element + screen it binds to and
// whether it is a coach bubble or a component reveal, the voice, and the clip.
// The optional expectedUser sub-row shows under a coach line behind a toggle.

const BIND_STYLE: Record<'bubble' | 'component', { bg: string; text: string; border: string; label: string }> = {
  bubble: { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe', label: 'bubble' },
  component: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0', label: 'component' },
};

const VOICE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  mp3: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  cartesia: { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' },
  verbatim: { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' },
};

function TinyChip({ label, s }: { label: string; s: { bg: string; text: string; border: string } }) {
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
  beat,
  showExpectedUser,
}: {
  beat: FlowBeat;
  showExpectedUser: boolean;
}) {
  const entry = BEAT_BY_ID[beat.id];

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
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entry.script.map((line: ScriptLine) => {
          const bind = BIND_STYLE[line.bindsTo.kind];
          const voiceStyle = line.voice ? VOICE_STYLE[line.voice] : null;
          return (
            <li
              key={line.seq}
              style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: line.seq === 1 ? 'none' : '1px solid #f1f5f9', paddingTop: line.seq === 1 ? 0 : 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#c7d2e0', minWidth: 14, flexShrink: 0 }}>
                  {line.seq}
                </span>
                <div style={{ fontSize: 13, lineHeight: 1.45, color: '#1e293b', flex: 1 }}>
                  {line.words || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>(silent reveal)</span>}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 22, alignItems: 'center' }}>
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
        <WordsFlagChip label={entry.voiceEngine} tone="engine" />
        {entry.expectedResponse && (
          <span style={{ fontSize: 10.5, color: '#94a3b8' }}>expects: {entry.expectedResponse}</span>
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

// --- Tab definitions ---
type TabId = 'onboarding' | 'app-tour' | 'chat' | 'morning' | 'evening' | 'weekly' | 'library';
interface TabDef {
  id: TabId;
  label: string;
  beats: FlowBeat[];
  title: string;
  subtitle: string;
  flow?: FlowEntry | undefined;
}

const FLOW_BY_ID: Partial<Record<TabId, FlowEntry>> = Object.fromEntries(
  FLOWS_SOURCE.map((flow) => [flow.id, flow]),
) as Partial<Record<TabId, FlowEntry>>;

const FLOW_PREFIXES: Record<Exclude<TabId, 'onboarding'>, string[]> = {
  'app-tour': ['app-tour-'],
  chat: ['chat-'],
  morning: ['morning-'],
  evening: ['evening-'],
  weekly: ['the-weekly-'],
  library: ['library-'],
};

function flowBeats(id: TabId): FlowBeat[] {
  if (id === 'onboarding') {
    return BEATS.filter((beat) => !Object.values(FLOW_PREFIXES).flat().some((prefix) => beat.id.startsWith(prefix)));
  }
  const prefixes = FLOW_PREFIXES[id];
  return BEATS.filter((beat) => prefixes.some((prefix) => beat.id.startsWith(prefix)));
}

export const TABS: TabDef[] = [
  {
    id: 'onboarding',
    label: 'Onboarding',
    beats: flowBeats('onboarding'),
    title: 'Onboarding flow',
    subtitle: 'Real flow-builder components, v3 content. Voice delivery tagged in the left margin.',
  },
  {
    id: 'app-tour',
    label: 'App tour',
    beats: flowBeats('app-tour'),
    title: 'App tour flow',
    subtitle: 'The home tour, authored as beats in the one source.',
    flow: FLOW_BY_ID['app-tour'],
  },
  {
    id: 'chat',
    label: 'Chat',
    beats: flowBeats('chat'),
    title: 'Coach chat flow',
    subtitle: 'Idle orb into the open coach chat surface.',
    flow: FLOW_BY_ID.chat,
  },
  {
    id: 'morning',
    label: 'Morning check-in',
    beats: flowBeats('morning'),
    title: 'Morning check-in flow',
    subtitle: 'Daily morning check-in: greeting, state card, partial gate, wrap.',
    flow: FLOW_BY_ID.morning,
  },
  {
    id: 'evening',
    label: 'Evening check-in',
    beats: flowBeats('evening'),
    title: 'Evening check-in flow',
    subtitle: 'Daily evening check-in: greeting, habit review, partial gate, reflection, wrap.',
    flow: FLOW_BY_ID.evening,
  },
  {
    id: 'weekly',
    label: 'The Weekly',
    beats: flowBeats('weekly'),
    title: 'The Weekly flow',
    subtitle: 'Weekly coach discussion beats, using current provisional wording where specified.',
    flow: FLOW_BY_ID.weekly,
  },
  {
    id: 'library',
    label: 'Library',
    beats: flowBeats('library'),
    title: 'Library flow',
    subtitle: 'Reset library structure only. Coach lines and per-track copy are pending.',
    flow: FLOW_BY_ID.library,
  },
];

// Pill tab switcher rendered above the legend.
function TabSwitcher({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
}) {
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
  engine,
  playing = false,
  showOrb = true,
  children,
}: {
  engine?: string;
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
      {/* Coach header, with the engine chip for this beat */}
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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {engine && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#6366f1',
                background: 'rgba(99,102,241,0.1)',
                padding: '3px 9px',
                borderRadius: 999,
              }}
            >
              {engine}
            </span>
          )}
        </div>
      </div>
      {/* Coach-blue interior: the beat at the top, the orb docked at the bottom on
          the same gradient (no white bar). The min height makes every phone at
          least a full real-phone screen; tall beats grow past it (longer than a
          phone) so nothing is ever clipped or shrunk below a phone. */}
      <div style={{ background: COACH_BG, display: 'flex', flexDirection: 'column', minHeight: 700 }}>
        <div style={{ flex: 1, padding: '18px 14px 8px', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
        {showOrb && (
          <div style={{ flexShrink: 0, padding: '8px 0 20px', display: 'flex', justifyContent: 'center' }}>
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
        });
      } else {
        // Hand-authored check-in beats (no script): legacy narration path.
        const m = beat.screenId ? METADATA_BY_SCREEN_ID[beat.screenId] : undefined;
        const opener = sample(m?.opener ?? beat.props?.coachLine ?? beat.props?.greeting ?? '');
        const lines = m?.elements
          ? [...m.elements].sort((a, c) => a.order - c.order).map((e) => sample(e.line))
          : [];
        await runBeatNarration({
          narration: m?.narration,
          kind: kindOf(beat.type),
          opener,
          lines,
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
    <PhoneCard
      engine={beat.engine}
      playing={active}
      showOrb={!beat.hideOrb}
    >
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

// Shared phone frame renderer. Each beat renders in its OWN phone card, with the
// source-of-truth rail in the left margin on the Onboarding tab.
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
  return (
    <div style={{ width: frameWidth, maxWidth: '100%', margin: '0 auto' }}>
      {/* Per-beat rows. The source-of-truth rail (left) and the phone (right) are
          top-aligned in one row. A path banner sits above the row when the beat
          starts a path branch. */}
      {beats.map((b, i) => {
        const branched = b.path === 'beginner' || b.path === 'advanced';
        const isStart = branched && b.path !== beats[i - 1]?.path;
        const isEnd = branched && b.path !== beats[i + 1]?.path;
        const isPlaying = playingId === b.id;
        return (
          <div key={b.id} data-beat-id={b.id} style={{ marginBottom: 34 }}>
            {showWords && (
              <BeatHeader
                n={i + 1}
                beat={b}
                playing={isPlaying}
                onTogglePlay={() => onRequestPlay(isPlaying ? null : b.id)}
              />
            )}
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
              </div>
              {/* Phone column: a self-contained phone with the orb, playable in place. */}
              <div style={{ flex: `0 0 ${PHONE_W}px` }}>
                <PlayableBeat
                  beat={b}
                  active={isPlaying}
                  onDone={() => onRequestPlay(null)}
                />
              </div>
              {showWords && (
                <div style={{ flex: `0 0 ${WORDS_COL_W}px`, marginLeft: WORDS_GAP, paddingTop: 8 }}>
                  <ScriptPanel beat={b} showExpectedUser={showExpectedUser} />
                </div>
              )}
            </div>
            {showWords && isEnd && <PathBanner path={b.path} edge="end" />}
          </div>
        );
      })}
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
        <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
          {tab.subtitle}
        </p>
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
      </div>

      <FlowLayerPanel flow={tab.flow} />

      {/* Main layout */}
      <FlowPhoneFrame
        beats={tab.beats}
        showWords
        showExpectedUser={showExpectedUser}
        playingId={playingId}
        onRequestPlay={setPlayingId}
      />
    </div>
  );
}
