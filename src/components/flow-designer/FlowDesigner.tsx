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
import { kindOf, raf, runBeatNarration, sample, stopSpeech } from './beatNarration';
import { FlowStateCtx, type FlowState, type HabitScheduleCfg } from './flowStateCtx';
import { Orb } from '@/components/orb/Orb';
import { orbSpeaking } from '@/components/orb/orbView';
import onboardingMetadataRaw from './onboardingMetadata.json';

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
// Sourced from the App Master Sheet Beats Context + Beat Elements tabs, snapshot
// at onboardingMetadata.json. Keyed by screenId, looked up per beat via
// FlowBeat.screenId below. Wording is provisional; the shape (opener, per-element
// lines, expectedResponse, engine/variable/bubble flags) is what to display.
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
const ONBOARDING_METADATA = onboardingMetadataRaw as { beats: BeatMeta[] };
export const METADATA_BY_SCREEN_ID: Record<string, BeatMeta> = Object.fromEntries(
  ONBOARDING_METADATA.beats.map((b) => [b.screenId, b]),
);

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

// A thin divider plus the beat number above each beat, so a beat's position in
// the flow is clear at a glance.
function BeatDivider({ n }: { n: number }) {
  return (
    <div style={{ marginTop: 28, marginBottom: 10 }}>
      <div style={{ height: 1, background: '#cbd5e1', width: '100%' }} />
      <div
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

function SourceOfTruthPanel({ beat }: { beat: FlowBeat }) {
  const meta = beat.screenId ? METADATA_BY_SCREEN_ID[beat.screenId] : undefined;
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
          No metadata for this beat yet.
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
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{beat.screenId}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {beat.type}
            {beat.path ? ` · ${PATH_STYLE[beat.path].label}` : ''}
          </div>
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

        <ContextSection title="Beat context" defaultOpen>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ContextKeyValue label="Expected response" value={meta.expectedResponse} />
            {meta.clipNote && <ContextKeyValue label="Clip note" value={meta.clipNote} />}
            {meta.variableNote && <ContextKeyValue label="Variable note" value={meta.variableNote} />}
            {meta.openerMode && <ContextKeyValue label="Opener mode" value={meta.openerMode} />}
          </div>
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

function WordsPanel({ screenId }: { screenId?: string }) {
  const meta = screenId ? METADATA_BY_SCREEN_ID[screenId] : undefined;

  if (!meta) {
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
        No words metadata for this beat yet.
      </div>
    );
  }

  const metaElements = sortedElements(meta);

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
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#94a3b8',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          Opener
        </div>
        {meta.opener ? (
          <div style={{ fontSize: 13, lineHeight: 1.5, color: '#1e293b' }}>{meta.opener}</div>
        ) : (
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: '#94a3b8', fontStyle: 'italic' }}>
            No opener, the per-element lines lead.
          </div>
        )}
      </div>

      {metaElements.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#94a3b8',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Per-element
          </div>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {metaElements.map((el) => (
              <li key={el.elementId} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#c7d2e0',
                    minWidth: 14,
                    flexShrink: 0,
                  }}
                >
                  {el.order}
                </span>
                <div>
                  <div style={{ fontSize: 13, lineHeight: 1.45, color: '#1e293b' }}>{el.line}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{el.elementId}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#94a3b8',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          Expected response
        </div>
        <div style={{ fontSize: 12.5, lineHeight: 1.45, color: '#475569' }}>{meta.expectedResponse}</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 2, borderTop: '1px solid #f1f5f9' }}>
        <WordsFlagChip label={meta.engine} tone="engine" />
        {meta.variable && (
          <WordsFlagChip
            label={`live${meta.variableNote ? `, ${meta.variableNote.split(',')[0]}` : ', name'}`}
            tone="live"
          />
        )}
        {meta.openerShowsAsBubble === false && meta.opener && <WordsFlagChip label="no bubble" tone="note" />}
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
  screenId?: string;
  path?: BeatPath;
  // Hide the docked orb on this beat. The orb fades out before the account step
  // and fades back in at mic permission, so the account beat shows no orb.
  hideOrb?: boolean;
}

// The render starts at the very beginning: splash, get started, the coach
// greeting, sign-up, and mic permission, then straight into profile and the
// rest of the onboarding chain, through the beginner and advanced lanes and
// the five weekly-projection frames.
export const BASE_BEATS: FlowBeat[] = [
  // 0a. Splash. Brand alone, no coach voice.
  {
    id: 'splash',
    type: 'splash',
    engine: 'Silent',
    mode: null,
    path: 'both',
  },
  // 0b. Get started. Brand + CTA, no coach voice.
  {
    id: 'get-started',
    type: 'get-started',
    engine: 'Silent',
    mode: null,
    path: 'both',
  },
  // 0c. Coach greeting. The locked SplashIntro sequence, MP3 verbatim.
  {
    id: 'coach-greeting',
    type: 'splash-intro',
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'COACH-GREETING',
    path: 'both',
    hideOrb: true,
  },
  // 0d. Sign up. Name capture, no coach voice.
  {
    id: 'sign-up',
    type: 'auth-signup',
    engine: 'Silent',
    mode: null,
    screenId: 'ONBOARD-AUTH--FORM',
    path: 'both',
    hideOrb: true,
  },
  // 0e. Mic permission. MP3 verbatim.
  {
    id: 'mic-permission',
    type: 'mic-permission',
    props: {
      heading: 'Allow your microphone',
      sub: 'So you can talk with your coach out loud.',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'MIC-PERMISSION',
    path: 'both',
    hideOrb: true,
  },
  // 1. Profile. Age + gender, greet by name. Cartesia VERBATIM: the opener is a
  // scripted line, but it carries the {name} token so it is read live, not an MP3.
  {
    id: 'profile',
    type: 'profile-beat',
    engine: 'Cartesia',
    mode: 'Verbatim',
    screenId: 'ONBOARD-01--FORM',
    path: 'both',
  },
  // 7 + 8 merged. The framing narration introduces the four check-in cards as it
  // names them (said once, synced to the reveal), then the SAME cards become the
  // check-in. No separate why-intro beat, no second set of cards, no double-say.
  {
    id: 'state-check',
    type: 'state-check',
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-STATE-CHECK',
    path: 'both',
  },
  // 8b. Morning check-in time. MP3 verbatim opener.
  {
    id: 'checkin',
    type: 'morning-checkin-setup',
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-MORNING-SETUP',
    path: 'both',
  },
  // 9. Evening reflection setup, configured only. MP3 verbatim opener, options silent.
  {
    id: 'reflection',
    type: 'reflection-card',
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-BEGINNER-07',
    path: 'both',
  },
  // 10. Path fork. MP3 verbatim.
  {
    id: 'fork',
    type: 'path-selection',
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-FORK--FORM',
    path: 'both',
  },
  // 11. Beginner, category. MP3 verbatim opener, options silent.
  {
    id: 'category',
    type: 'category-grid',
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-BEGINNER-01',
    path: 'beginner',
  },
  // 11b. Women's variant of the category tiles, shown when the user picked Female.
  // Same categories and copy, female illustrations. The images are placeholders
  // until real female art is dropped into public/images/onboarding/female/ (same
  // filenames as the default tiles).
  {
    id: 'category-women',
    type: 'category-grid',
    props: {
      variant: 'female',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-BEGINNER-01',
    path: 'beginner',
  },
  // 12. Beginner, subcategory. MP3 verbatim opener, options silent.
  {
    id: 'goals',
    type: 'goals-list',
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-BEGINNER-02',
    path: 'beginner',
  },
  // 12b. Create your own goal. Reached from "Create your own goal" in the goals
  // beat: a simple name-your-goal screen, then back into the flow.
  {
    id: 'goal-custom',
    type: 'custom-entry',
    props: {
      kind: 'goal',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-BEGINNER-02-CUSTOM',
    path: 'beginner',
  },
  // 13. Beginner, habits. MP3 verbatim opener, options silent.
  {
    id: 'habits',
    type: 'habit-picker',
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-BEGINNER-03',
    path: 'beginner',
  },
  // 13b. Create your own habit. Reached from "Create your own habit" in the habit
  // beat: a simple name-your-habit screen, then back into the flow.
  {
    id: 'habit-custom',
    type: 'custom-entry',
    props: {
      kind: 'habit',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-BEGINNER-03-CUSTOM',
    path: 'beginner',
  },
  // 14. Beginner, per-habit schedule. MP3 scheduler with per-element control lines
  // (schedule, when, how-often, reminder). Not Vapi; the metadata marks it MP3.
  {
    id: 'schedule',
    type: 'habit-schedule',
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-BEGINNER-04',
    path: 'beginner',
  },
  // 15. Advanced lane. Users who already track habits read them out loud,
  // cards form live, each auto-classified build/break. MP3 verbatim opener.
  {
    id: 'advanced-capture',
    type: 'advanced-capture',
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-ADVANCED',
    path: 'advanced',
  },
  // 16. Advanced lane, frequency. Same cards, day circles grow out. MP3 verbatim opener.
  {
    id: 'advanced-frequency',
    type: 'advanced-frequency',
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-ADVANCED-FREQUENCY',
    path: 'advanced',
  },
  // 17. Full plan, the one confirm. MP3 verbatim.
  {
    id: 'plan',
    type: 'into-app',
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-COMPLETE',
    path: 'both',
  },
  // 18a-18e. Weekly projection. Five frames, each a different outcome state of
  // the habit week-grid, shown right after the plan confirm. MP3 verbatim.
  {
    id: 'weekly-blank',
    type: 'weekly-projection',
    props: {
      state: 'blank',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-BLANK',
    path: 'both',
  },
  {
    id: 'weekly-full',
    type: 'weekly-projection',
    props: {
      state: 'full',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-FULL',
    path: 'both',
  },
  {
    id: 'weekly-p78',
    type: 'weekly-projection',
    props: {
      state: 'p78',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-P78',
    path: 'both',
  },
  {
    id: 'weekly-p36',
    type: 'weekly-projection',
    props: {
      state: 'p36',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-P36',
    path: 'both',
  },
  {
    id: 'weekly-gaps',
    type: 'weekly-projection',
    props: {
      state: 'gaps',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-GAPS',
    path: 'both',
  },
];

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
    props: { text: "Energy a little low, that makes sense. Sleep was short. Let's keep today light and focused." },
    engine: 'Cartesia',
    mode: 'Improvise',
  },
  {
    id: 'morning-are-you-done',
    type: 'coach-bubble',
    props: { text: 'Looks like there are a few items left. Want to add anything, or should we move on?' },
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
    props: { text: 'Looks like there are a few items left. Want to add anything, or should we move on?' },
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
  onTogglePlay,
  showOrb = true,
  children,
}: {
  engine?: string;
  playing?: boolean;
  onTogglePlay?: () => void;
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
          {onTogglePlay && (
            <button
              type="button"
              onClick={onTogglePlay}
              title={playing ? 'Stop' : 'Play this beat'}
              aria-label={playing ? 'Stop this beat' : 'Play this beat'}
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: playing ? '#ef4444' : '#135BEB',
                flexShrink: 0,
              }}
            >
              <Icon
                icon={playing ? 'mdi:stop' : 'mdi:play'}
                width={16}
                height={16}
                style={{ color: '#fff' }}
              />
            </button>
          )}
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
    const m = beat.screenId ? METADATA_BY_SCREEN_ID[beat.screenId] : undefined;
    const opener = sample(m?.opener ?? beat.props?.coachLine ?? beat.props?.greeting ?? '');
    const lines = m?.elements
      ? [...m.elements].sort((a, c) => a.order - c.order).map((e) => sample(e.line))
      : [];
    (async () => {
      // Let the fresh remount settle to an empty state, then run the script.
      await raf();
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
      onTogglePlay={() => onRequestPlay(active ? null : beat.id)}
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
  playingId,
  onRequestPlay,
}: {
  beats: FlowBeat[];
  showWords?: boolean;
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
        return (
          <div key={b.id} data-beat-id={b.id} style={{ marginBottom: 34 }}>
            {showWords && <BeatDivider n={i + 1} />}
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
                  active={playingId === b.id}
                  onRequestPlay={onRequestPlay}
                  onDone={() => onRequestPlay(null)}
                />
              </div>
              {showWords && (
                <div style={{ flex: `0 0 ${WORDS_COL_W}px`, marginLeft: WORDS_GAP, paddingTop: 8 }}>
                  <WordsPanel screenId={b.screenId} />
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
      </div>

      {/* Main layout */}
      <FlowPhoneFrame
        beats={tab.beats}
        showWords={tab.id === 'onboarding'}
        playingId={playingId}
        onRequestPlay={setPlayingId}
      />
    </div>
  );
}
