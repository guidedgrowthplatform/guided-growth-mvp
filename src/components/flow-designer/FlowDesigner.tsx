import { Icon } from '@iconify/react';
import { createElement, useState, type ReactNode } from 'react';
import { AnimationsCtx, PlayingCtx, type BeatDef } from './beatKit';
import { BEAT_DEFS } from './beats';
import { FlowStateCtx, type FlowState, type HabitScheduleCfg } from './flowStateCtx';
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
// [tag column | phone column | words column], so a tag, its beat, and its
// words card share one flex row and stay aligned by construction at every
// scroll position.
const TAG_COL_W = 130; // fixed-width left column holding the voice tag
const TAG_GAP = 14; // space between the tag and the phone's left edge
const PHONE_W = 420; // the phone interior width
const WORDS_COL_W = 300; // fixed-width right column holding the words card
const WORDS_GAP = 20; // space between the phone's right edge and the words card
const TOTAL_W = TAG_COL_W + PHONE_W; // phone-frame width (words column sits outside this)

// The real beat registry, keyed by type. BEAT_DEFS auto-collects every beat
// file (the same set the flow builder uses). REGISTRY_MAP[type].Comp is the
// real component for that beat.
const REGISTRY_MAP: Record<string, BeatDef> = Object.fromEntries(
  BEAT_DEFS.map((d) => [d.type, d]),
);

// --- Onboarding words metadata (the right "words" column) ---
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
  openerMode?: string;
  openerShowsAsBubble?: boolean;
  expectedResponse: string;
  clipReuse?: string;
  elements: BeatElementMeta[];
}
const ONBOARDING_METADATA = onboardingMetadataRaw as { beats: BeatMeta[] };
const METADATA_BY_SCREEN_ID: Record<string, BeatMeta> = Object.fromEntries(
  ONBOARDING_METADATA.beats.map((b) => [b.screenId, b]),
);

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

function IsolatedBeat({
  type,
  props,
}: {
  type: string;
  props?: Record<string, string>;
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
    <PlayingCtx.Provider value={true}>
      <AnimationsCtx.Provider value={false}>
        <FlowStateCtx.Provider value={flowState}>
          <div className="overflow-hidden [transform:translateZ(0)]">
            {createElement(entry.Comp, applyName(props))}
          </div>
        </FlowStateCtx.Provider>
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

// --- Words panel (the right column) ---
// Read-only card showing the verbatim opener, per-element lines (only when the
// beat has elements), the expected response, and small engine/variable/bubble
// flags. Looked up per beat by screenId against METADATA_BY_SCREEN_ID.

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

  const sortedElements = [...meta.elements].sort((a, b) => a.order - b.order);

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
      {/* Opener */}
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

      {/* Per-element lines */}
      {sortedElements.length > 0 && (
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
            {sortedElements.map((el) => (
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

      {/* Expected response */}
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

      {/* Flags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 2, borderTop: '1px solid #f1f5f9' }}>
        <WordsFlagChip label={meta.engine} tone="engine" />
        {meta.variable && (
          <WordsFlagChip label={`live${meta.variableNote ? `, ${meta.variableNote.split(',')[0]}` : ', name'}`} tone="live" />
        )}
        {meta.openerShowsAsBubble === false && meta.opener && <WordsFlagChip label="no bubble" tone="note" />}
      </div>
    </div>
  );
}

// --- Beats, v3 order + copy. Each names a real registry type, the props it
// passes (coachLine and any seed props), and the engine + mode tag. ---

interface FlowBeat {
  id: string;
  type: string;
  props?: Record<string, string>;
  engine: VoiceEngine;
  mode: VoiceMode;
  screenId?: string;
}

// The render starts at the very beginning: splash, get started, the coach
// greeting, sign-up, and mic permission, then straight into profile and the
// rest of the onboarding chain, through the beginner and advanced lanes and
// the five weekly-projection frames.
const BEATS: FlowBeat[] = [
  // 0a. Splash. Brand alone, no coach voice.
  {
    id: 'splash',
    type: 'splash',
    engine: 'Silent',
    mode: null,
  },
  // 0b. Get started. Brand + CTA, no coach voice.
  {
    id: 'get-started',
    type: 'get-started',
    engine: 'Silent',
    mode: null,
  },
  // 0c. Coach greeting. The locked SplashIntro sequence, MP3 verbatim.
  {
    id: 'coach-greeting',
    type: 'splash-intro',
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'COACH-GREETING',
  },
  // 0d. Sign up. Name capture, no coach voice.
  {
    id: 'sign-up',
    type: 'auth-signup',
    engine: 'Silent',
    mode: null,
    screenId: 'ONBOARD-AUTH--FORM',
  },
  // 0e. Mic permission. MP3 verbatim.
  {
    id: 'mic-permission',
    type: 'mic-permission',
    props: {
      heading: 'Allow your microphone',
      sub: 'So you can talk with your coach out loud.',
      coachLine:
        "I'd love to actually talk with you. If you let me use your mic, you can just speak.",
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'MIC-PERMISSION',
  },
  // 1. Profile. Age + gender, greet by name. Cartesia VERBATIM: the opener is a
  // scripted line, but it carries the {name} token so it is read live, not an MP3.
  {
    id: 'profile',
    type: 'profile-beat',
    props: {
      greeting: 'Good to meet you, {name}. Two quick things so I can tailor this to you.',
      askAge: 'How old are you?',
      askGender: 'And your gender?',
      age: '28',
      gender: 'Male',
    },
    engine: 'Cartesia',
    mode: 'Verbatim',
    screenId: 'ONBOARD-01--FORM',
  },
  // 7. Why intro. MP3 verbatim.
  {
    id: 'why-intro',
    type: 'why-intro',
    props: {
      coachLine:
        "Here's the idea. The first habit isn't a workout or a diet. It's just checking in with yourself. It takes a minute, and it changes everything else. Let's start yours right now.",
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-WHY-INTRO',
  },
  // 8a. First state check, the first habit. MP3 verbatim opener.
  {
    id: 'state-check',
    type: 'state-check',
    props: {
      coachLine:
        "Let's do your first check-in right now. How are you landing in this moment? Mood, energy, sleep, anything on you.",
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-STATE-CHECK',
  },
  // 8b. Morning check-in time. MP3 verbatim opener.
  {
    id: 'checkin',
    type: 'morning-checkin-setup',
    props: {
      coachLine: "When do you want this each day? I'll nudge you then.",
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-MORNING-SETUP',
  },
  // 9. Evening reflection setup, configured only. MP3 verbatim opener, options silent.
  {
    id: 'reflection',
    type: 'reflection-card',
    props: {
      coachLine:
        'One more. An evening reflection, a couple of minutes to close the day. How do you want to do it, and when?',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-BEGINNER-07',
  },
  // 10. Path fork. MP3 verbatim.
  {
    id: 'fork',
    type: 'path-selection',
    props: {
      coachLine: 'Quick one. Have you tracked habits before, or is this new for you? Both are totally fine.',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-FORK--FORM',
  },
  // 11. Beginner, category. MP3 verbatim opener, options silent.
  {
    id: 'category',
    type: 'category-grid',
    props: {
      coachLine:
        'What part of your life do you most want to work on right now? Pick the one that pulls you.',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-BEGINNER-01',
  },
  // 12. Beginner, subcategory. MP3 verbatim opener, options silent.
  {
    id: 'goals',
    type: 'goals-list',
    props: { coachLine: "Within that, what's the piece you want to start with?" },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-BEGINNER-02',
  },
  // 13. Beginner, habits. MP3 verbatim opener, options silent.
  {
    id: 'habits',
    type: 'habit-picker',
    props: {
      coachLine:
        "Pick the habits that feel doable. Not impressive, just doable. One you'll actually keep beats five you won't. Make your own if nothing here fits.",
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-BEGINNER-03',
  },
  // 14. Beginner, per-habit schedule. MP3 scheduler with per-element control lines
  // (schedule, when, how-often, reminder). Not Vapi; the metadata marks it MP3.
  {
    id: 'schedule',
    type: 'habit-schedule',
    props: {
      coachLine: 'How often, and roughly when, for each one? Add a reminder only if you want a nudge.',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-BEGINNER-04',
  },
  // 15. Advanced lane. Users who already track habits read them out loud,
  // cards form live, each auto-classified build/break. MP3 verbatim opener.
  {
    id: 'advanced-capture',
    type: 'advanced-capture',
    props: {
      coachLine:
        'Read me the habits you already track. Less is more to start, you can always build on it.',
      closeCoachLine:
        "Those are all in, and I marked each as build or break. Tell me if any look wrong. If they're good, we'll set the days next.",
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-ADVANCED',
  },
  // 16. Advanced lane, frequency. Same cards, day circles grow out. MP3 verbatim opener.
  {
    id: 'advanced-frequency',
    type: 'advanced-frequency',
    props: {
      coachLine: "Now the days. Tell me how often each one runs and I'll fill them in.",
      confirmCoachLine: 'Your habits are all set, your plan is ready.',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-ADVANCED-FREQUENCY',
  },
  // 17. Full plan, the one confirm. MP3 verbatim.
  {
    id: 'plan',
    type: 'into-app',
    props: {
      coachLine:
        "Here's your plan. Your check-in, your reflection, and the habits you picked. Want to start here, or change anything first?",
      buttonLabel: 'Start',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-COMPLETE',
  },
  // 18a-18e. Weekly projection. Five frames, each a different outcome state of
  // the habit week-grid, shown right after the plan confirm. MP3 verbatim.
  {
    id: 'weekly-blank',
    type: 'weekly-projection',
    props: {
      state: 'blank',
      coachLine: 'This is your week. Blank, starting today.',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-BLANK',
  },
  {
    id: 'weekly-full',
    type: 'weekly-projection',
    props: {
      state: 'full',
      coachLine: 'Best case, every day green. Every streak going strong. That would be amazing.',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-FULL',
  },
  {
    id: 'weekly-p78',
    type: 'weekly-projection',
    props: {
      state: 'p78',
      coachLine:
        "More likely, you land around here. Mostly green, a few misses, your streaks holding. That's a real win.",
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-P78',
  },
  {
    id: 'weekly-p36',
    type: 'weekly-projection',
    props: {
      state: 'p36',
      coachLine:
        "Some weeks land here. One streak survives, the rest take a hit. Still fine, you're building. We reassess.",
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-P36',
  },
  {
    id: 'weekly-gaps',
    type: 'weekly-projection',
    props: {
      state: 'gaps',
      coachLine:
        'The one thing we want to avoid is this. The empty days you never reported. Stay consistent, just report it. Even a miss counts, that keeps us going.',
    },
    engine: 'MP3',
    mode: 'Verbatim',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-GAPS',
  },
];

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

// Shared phone frame renderer. Accepts the beats array and a phone header label.
// `showWords` renders a third right-hand column (the words panel) per beat row;
// only the Onboarding tab has metadata to show there.
function FlowPhoneFrame({ beats, showWords = false }: { beats: FlowBeat[]; showWords?: boolean }) {
  const frameWidth = showWords ? TOTAL_W + WORDS_GAP + WORDS_COL_W : TOTAL_W;
  return (
    <div style={{ width: frameWidth, maxWidth: '100%', margin: '0 auto' }}>
      {/* Status bar (offset to sit above the phone column) */}
      <div style={{ display: 'flex' }}>
        <div style={{ flex: `0 0 ${TAG_COL_W}px` }} />
        <div
          style={{
            flex: `0 0 ${PHONE_W}px`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderTop: '1px solid #e2e8f0',
            borderLeft: '1px solid #e2e8f0',
            borderRight: '1px solid #e2e8f0',
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            background: '#fff',
            padding: '16px 20px',
          }}
        >
          <Icon icon="ic:round-auto-awesome" style={{ width: 20, height: 20, color: '#6366f1' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Coach</span>
        </div>
        {showWords && (
          <div
            style={{
              flex: `0 0 ${WORDS_COL_W}px`,
              marginLeft: WORDS_GAP,
              fontSize: 11,
              fontWeight: 700,
              color: '#94a3b8',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 2,
            }}
          >
            Words
          </div>
        )}
      </div>

      {/* Per-beat rows. tag (left), beat (center), and words (right, when
          showWords) are top-aligned in one row. */}
      {beats.map((b) => (
        <div key={b.id} data-beat-id={b.id} style={{ display: 'flex', alignItems: 'flex-start' }}>
          {/* Tag column: fixed width, right-aligned so the tag sits flush to
              the phone's left edge, top-aligned to the beat's opener. */}
          <div
            style={{
              flex: `0 0 ${TAG_COL_W}px`,
              display: 'flex',
              justifyContent: 'flex-end',
              paddingRight: TAG_GAP,
              paddingTop: 24,
            }}
          >
            <VoiceTag engine={b.engine} mode={b.mode} />
          </div>
          {/* Beat column: the phone interior, side borders + bg per row so the
              rows read as one continuous phone. */}
          <div
            style={{
              flex: `0 0 ${PHONE_W}px`,
              borderLeft: '1px solid #e2e8f0',
              borderRight: '1px solid #e2e8f0',
              background: '#f9f9f9',
              padding: '24px 20px',
            }}
          >
            <IsolatedBeat type={b.type} props={b.props} />
          </div>
          {/* Words column: the right-hand authoring card, top-aligned with the
              beat's opener. Only rendered on tabs with metadata (Onboarding). */}
          {showWords && (
            <div
              style={{
                flex: `0 0 ${WORDS_COL_W}px`,
                marginLeft: WORDS_GAP,
                paddingTop: 24,
              }}
            >
              <WordsPanel screenId={b.screenId} />
            </div>
          )}
        </div>
      ))}

      {/* Bottom input bar (offset to sit below the phone column) */}
      <div style={{ display: 'flex' }}>
        <div style={{ flex: `0 0 ${TAG_COL_W}px` }} />
        <div
          style={{
            flex: `0 0 ${PHONE_W}px`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1px solid #e2e8f0',
            borderLeft: '1px solid #e2e8f0',
            borderRight: '1px solid #e2e8f0',
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            background: '#fff',
            padding: '12px 16px',
          }}
        >
          <div
            style={{
              flex: 1,
              borderRadius: 99,
              background: '#f1f5f9',
              padding: '8px 16px',
              fontSize: 14,
              color: '#94a3b8',
            }}
          >
            Type or talk...
          </div>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 99,
              background: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon icon="ic:round-mic" style={{ width: 20, height: 20, color: '#fff' }} />
          </div>
        </div>
        {showWords && <div style={{ flex: `0 0 ${WORDS_COL_W}px`, marginLeft: WORDS_GAP }} />}
      </div>
    </div>
  );
}

export function FlowDesigner() {
  const [activeTab, setActiveTab] = useState<TabId>('onboarding');
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
        <TabSwitcher active={activeTab} onChange={setActiveTab} />
        <VoiceLegend />
      </div>

      {/* Main layout */}
      <FlowPhoneFrame beats={tab.beats} showWords={tab.id === 'onboarding'} />
    </div>
  );
}
