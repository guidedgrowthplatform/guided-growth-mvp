import { Icon } from '@iconify/react';
import { createElement, useState, type ReactNode } from 'react';
import { AnimationsCtx, PlayingCtx, type BeatDef } from './beatKit';
import { BEAT_DEFS } from './beats';
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

// The real beat registry, keyed by type. BEAT_DEFS auto-collects every beat
// file (the same set the flow builder uses). REGISTRY_MAP[type].Comp is the
// real component for that beat.
const REGISTRY_MAP: Record<string, BeatDef> = Object.fromEntries(
  BEAT_DEFS.map((d) => [d.type, d]),
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

function IsolatedBeat({
  type,
  props,
}: {
  type: string;
  props?: Record<string, string>;
}) {
  const flowState = useIsolatedFlowState();
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

// --- Beats, v3 order + copy. Each names a real registry type, the props it
// passes (coachLine and any seed props), and the engine + mode tag. ---

interface FlowBeat {
  id: string;
  type: string;
  props?: Record<string, string>;
  engine: VoiceEngine;
  mode: VoiceMode;
}

const BEATS: FlowBeat[] = [
  // 1. Splash. Silent.
  { id: 'splash', type: 'splash', engine: 'Silent', mode: null },
  // 2. Get Started. Silent.
  { id: 'get-started', type: 'get-started', engine: 'Silent', mode: null },
  // 3. Coach Greeting. The orb blooms and speaks. MP3 verbatim.
  {
    id: 'coach-greeting',
    type: 'splash-intro',
    props: {
      coachLine:
        "Hey. I'm your coach inside Guided Growth. Give me two minutes and we'll set up something that actually sticks.",
    },
    engine: 'MP3',
    mode: 'Verbatim',
  },
  // 4. Sign Up. Silent form, the name is captured here.
  { id: 'signup', type: 'auth-signup', engine: 'Silent', mode: null },
  // 5. Mic Permission. MP3 verbatim opener.
  {
    id: 'mic',
    type: 'mic-permission',
    props: {
      heading: 'Talk with your coach',
      sub: 'Turn on your mic to talk out loud. You can always type instead.',
      coachLine:
        "I'd love to actually talk with you. If you let me use your mic, you can just speak. You can always type instead.",
    },
    engine: 'MP3',
    mode: 'Verbatim',
  },
  // 6. Profile. Age + gender, greet by name. Cartesia, improvised (dynamic name).
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
    mode: 'Improvise',
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
  },
  // 8. Morning check-in. State card now, then set the daily time. MP3 verbatim opener.
  {
    id: 'checkin',
    type: 'morning-checkin-setup',
    props: {
      coachLine:
        "Let's do your first check-in right now. How are you landing in this moment? Mood, energy, sleep, anything on you.",
    },
    engine: 'MP3',
    mode: 'Verbatim',
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
  },
  // 10. Path fork. MP3 verbatim.
  {
    id: 'fork',
    type: 'path-selection',
    props: {
      coachLine: 'Quick one. Have you tracked habits before, or is this new for you? Either way is great.',
    },
    engine: 'MP3',
    mode: 'Verbatim',
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
  },
  // 12. Beginner, subcategory. MP3 verbatim opener, options silent.
  {
    id: 'goals',
    type: 'goals-list',
    props: { coachLine: "Within that, what's the piece you want to start with?" },
    engine: 'MP3',
    mode: 'Verbatim',
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
  },
  // 14. Beginner, per-habit schedule. Vapi, live config.
  {
    id: 'schedule',
    type: 'habit-schedule',
    props: {
      coachLine: 'When will you do each one? Pick the days and a time. A reminder only if you want a nudge.',
    },
    engine: 'Vapi',
    mode: 'Improvise',
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
  },
];

export function FlowDesigner() {
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
          Onboarding flow
        </h1>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
          Real flow-builder components, v3 content. Voice delivery tagged in the left margin.
        </p>
      </div>

      {/* Legend */}
      <div style={{ maxWidth: 720, margin: '0 auto 8px' }}>
        <VoiceLegend />
      </div>

      {/* Main layout: left tag column, then the phone */}
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 20,
        }}
      >
        {/* Voice tag column (outside the phone, LEFT) */}
        <div
          style={{
            flex: '0 0 150px',
            display: 'flex',
            flexDirection: 'column',
            // Align the first tag to roughly the first beat:
            // status bar (~53px) + stream padding (24px) + a little.
            paddingTop: 90,
            gap: 0,
            textAlign: 'right',
          }}
        >
          {BEATS.map((b) => (
            <BeatTagSlot key={b.id} engine={b.engine} mode={b.mode} />
          ))}
        </div>

        {/* Phone frame */}
        <div
          style={{
            flex: '0 0 420px',
            maxWidth: 420,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 32,
            border: '1px solid #e2e8f0',
            background: '#fff',
            boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          }}
        >
          {/* Status bar */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderBottom: '1px solid #f1f5f9',
              background: '#fff',
              padding: '16px 20px',
            }}
          >
            <Icon icon="ic:round-auto-awesome" style={{ width: 20, height: 20, color: '#6366f1' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Coach</span>
          </div>

          {/* Beat stream, continuous. Each beat is the real component. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              padding: '24px 20px',
              background: '#f9f9f9',
            }}
          >
            {BEATS.map((b) => (
              <div key={b.id} data-beat-id={b.id}>
                <IsolatedBeat type={b.type} props={b.props} />
              </div>
            ))}
          </div>

          {/* Bottom input bar */}
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderTop: '1px solid #f1f5f9',
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
        </div>
      </div>
    </div>
  );
}

// One tag row beside its beat. FlowDesigner is a continuous scroll, not a
// per-screen layout, so tags are approximately aligned to their beats. The
// tag is right-aligned in its column so it sits flush against the phone's left
// edge, next to the left-aligned coach bubble.
function BeatTagSlot({ engine, mode }: { engine: VoiceEngine; mode: VoiceMode }): ReactNode {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
        paddingTop: 30,
        minHeight: 80,
      }}
    >
      <VoiceTag engine={engine} mode={mode} />
    </div>
  );
}
