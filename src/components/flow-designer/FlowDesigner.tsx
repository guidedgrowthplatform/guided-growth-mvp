import { Icon } from '@iconify/react';
import { useState, type ReactElement } from 'react';
import { checkInDimensions } from '@/components/home/checkInConfig';
import { EmojiOptionButton } from '@/components/home/EmojiOptionButton';
import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { DailyReflectionCard } from '@/components/onboarding/DailyReflectionCard';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { HabitPickerPanel } from '@/components/onboarding/HabitPickerPanel';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import type { ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { ChipSelect } from '@/components/ui/ChipSelect';

/**
 * FlowDesigner -- the chat-native onboarding flow as one continuous scroll,
 * built from the REAL app components (not lookalikes) with real onboarding
 * content (the 8 categories, real goals, real sub-habits, real gender
 * options, real coach lines).
 *
 * Lives in three places: a Storybook story (Flow / Flow Designer), a dev-only
 * /flow-designer route in the app, and a standalone hosted build.
 *
 * Voice engine badges sit OUTSIDE the phone frame, in the right margin,
 * aligned to each beat. Four kinds:
 *   MP3       -- pre-recorded verbatim clip (blue)
 *   Cartesia  -- live dynamic TTS, dynamic content (purple)
 *   Vapi      -- live two-way coaching session (green)
 *   Silent    -- no coach voice at this beat (gray)
 */

// --- Beat bodies: each holds its own local state and renders real components.

function ProfileBody() {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<string | null>('Male');
  return (
    <div className="flex flex-col gap-4">
      <OnboardingInput
        icon="mdi:account-outline"
        placeholder="What should I call you?"
        value={name}
        onChange={setName}
      />
      <ChipSelect
        options={['Male', 'Female', 'Other']}
        value={gender}
        onChange={setGender}
        ariaLabel="How do you identify?"
        columns={3}
      />
    </div>
  );
}

function CategoryBody() {
  const cats = [
    { label: 'Sleep better', image: '/images/onboarding/sleep-better.png' },
    { label: 'Move more', image: '/images/onboarding/move-more.jpg' },
    { label: 'Eat better', image: '/images/onboarding/eat-better.png' },
    { label: 'Feel more energized', image: '/images/onboarding/feel-more-energized.png' },
    { label: 'Reduce stress', image: '/images/onboarding/reduce-stress.png' },
    { label: 'Improve focus', image: '/images/onboarding/improve-focus.jpg' },
    { label: 'Break bad habits', image: '/images/onboarding/break-bad-habits.png' },
    { label: 'Get more organized', image: '/images/onboarding/get-more-organized.png' },
  ];
  const [sel, setSel] = useState('Sleep better');
  return (
    <div className="grid grid-cols-2 gap-3">
      {cats.map((c) => (
        <CategoryCard
          key={c.label}
          image={c.image}
          label={c.label}
          selected={sel === c.label}
          onSelect={() => setSel(c.label)}
        />
      ))}
    </div>
  );
}

function GoalsBody() {
  const goals = [
    'Fall asleep earlier',
    'Wake up earlier',
    'Sleep more consistently',
    'Sleep more deeply',
  ];
  const [sel, setSel] = useState<Set<string>>(new Set(['Fall asleep earlier']));
  return (
    <div className="flex flex-col gap-3">
      {goals.map((g) => (
        <GoalCard
          key={g}
          label={g}
          selected={sel.has(g)}
          onToggle={() =>
            setSel((prev) => {
              const next = new Set(prev);
              if (next.has(g)) next.delete(g);
              else next.add(g);
              return next;
            })
          }
        />
      ))}
    </div>
  );
}

function HabitsBody() {
  const [expanded, setExpanded] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set(['No screens after 10 PM']));
  const habits = [
    'No caffeine after 2 PM',
    'No screens after 10 PM',
    'Start wind-down by 10 PM',
    'Be in bed by target bedtime',
  ];
  return (
    <HabitPickerPanel
      goal="Fall asleep earlier"
      habits={habits}
      expanded={expanded}
      onToggleExpanded={() => setExpanded((v) => !v)}
      selectedHabits={sel}
      onToggleHabit={(h) =>
        setSel((prev) => {
          const next = new Set(prev);
          if (next.has(h)) next.delete(h);
          else next.add(h);
          return next;
        })
      }
      onAddCustomHabit={(h) => setSel((prev) => new Set(prev).add(h))}
    />
  );
}

function ReflectionBody() {
  const [time, setTime] = useState('21:30');
  const [days, setDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
  const [reminder, setReminder] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleOption>('Every day');
  return (
    <DailyReflectionCard
      time={time}
      onTimeChange={setTime}
      days={days}
      onToggleDay={(d) =>
        setDays((prev) => {
          const next = new Set(prev);
          if (next.has(d)) next.delete(d);
          else next.add(d);
          return next;
        })
      }
      reminder={reminder}
      onToggleReminder={setReminder}
      schedule={schedule}
      onScheduleChange={setSchedule}
    />
  );
}

function PlanBody() {
  return (
    <div className="flex flex-col gap-3">
      <PlanSummaryCard
        icon="mdi:bed-outline"
        typeLabel="Habit"
        title="No screens after 10 PM"
        cadence="Every day"
        rule="10:00 PM"
        onEdit={() => {}}
      />
      <PlanSummaryCard
        icon="mdi:notebook-outline"
        typeLabel="Journal"
        title="Daily Reflection"
        cadence="Every day"
        rule="3 questions"
        onEdit={() => {}}
      />
    </div>
  );
}

function CheckinBody() {
  const mood = checkInDimensions.find((d) => d.key === 'mood')!;
  const [sel, setSel] = useState<number | null>(4);
  return (
    <div className="flex w-full justify-between">
      {mood.options.map((o) => (
        <EmojiOptionButton
          key={o.value}
          icon={o.icon}
          label={o.label}
          color={o.color}
          isSelected={sel === o.value}
          onClick={() => setSel(o.value)}
        />
      ))}
    </div>
  );
}

// --- Voice engine badge ---

type VoiceEngine = 'MP3' | 'Cartesia' | 'Vapi' | 'Silent';

const ENGINE_META: Record<
  VoiceEngine,
  { label: string; icon: string; bg: string; text: string; border: string; note?: string }
> = {
  MP3: {
    label: 'MP3',
    icon: 'mdi:play-circle-outline',
    bg: '#dbeafe',
    text: '#1d4ed8',
    border: '#93c5fd',
    note: 'Pre-recorded verbatim',
  },
  Cartesia: {
    label: 'Cartesia',
    icon: 'mdi:waveform',
    bg: '#ede9fe',
    text: '#6d28d9',
    border: '#c4b5fd',
    note: 'Live dynamic TTS',
  },
  Vapi: {
    label: 'Vapi',
    icon: 'mdi:microphone-outline',
    bg: '#dcfce7',
    text: '#15803d',
    border: '#86efac',
    note: 'Live two-way coaching',
  },
  Silent: {
    label: 'Silent',
    icon: 'mdi:volume-off',
    bg: '#f1f5f9',
    text: '#64748b',
    border: '#cbd5e1',
    note: 'No coach voice',
  },
};

function VoiceEngineBadge({
  engine,
  note,
}: {
  engine: VoiceEngine;
  note?: string;
}) {
  const m = ENGINE_META[engine];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 3,
        minWidth: 108,
        maxWidth: 140,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 8px',
          borderRadius: 99,
          border: `1.5px solid ${m.border}`,
          background: m.bg,
          color: m.text,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
        }}
      >
        <Icon icon={m.icon} style={{ width: 12, height: 12 }} />
        {m.label}
      </div>
      {(note ?? m.note) && (
        <span
          style={{
            fontSize: 10,
            color: '#94a3b8',
            lineHeight: 1.3,
            paddingLeft: 2,
          }}
        >
          {note ?? m.note}
        </span>
      )}
    </div>
  );
}

// --- Legend ---

function VoiceLegend() {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '12px 14px',
        marginBottom: 24,
        width: 420,
        maxWidth: '100%',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        fontFamily: 'Urbanist, -apple-system, sans-serif',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Voice delivery
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {(Object.keys(ENGINE_META) as VoiceEngine[]).map((engine) => {
          const m = ENGINE_META[engine];
          return (
            <div key={engine} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 99,
                  border: `1.5px solid ${m.border}`,
                  background: m.bg,
                  color: m.text,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                <Icon icon={m.icon} style={{ width: 11, height: 11 }} />
                {m.label}
              </div>
              <span style={{ fontSize: 11, color: '#64748b' }}>{m.note}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Beat data with voice engine mapping ---

interface Beat {
  id: string;
  name: string;
  coachLine: string;
  Body: () => ReactElement;
  reply?: string;
  voiceEngine: VoiceEngine;
  voiceNote?: string;
}

const BEATS: Beat[] = [
  {
    id: 'profile',
    name: 'Profile',
    coachLine: "Hey, I'm your coach. Good to meet you. A couple of quick things.",
    Body: ProfileBody,
    // Name was captured at sign-up; coach greets by name dynamically via Cartesia
    voiceEngine: 'Cartesia',
    voiceNote: 'Greets by name, dynamic',
  },
  {
    id: 'category',
    name: 'Focus area',
    coachLine: 'What do you want to grow? Not sure? Talk it through with me.',
    Body: CategoryBody,
    reply: "Sleep, yeah. That's the foundation.",
    // Opener is MP3; live Vapi coaching available if user is unsure
    voiceEngine: 'MP3',
    voiceNote: 'Opener MP3 + Vapi if unsure',
  },
  {
    id: 'goals',
    name: 'Subcategory',
    coachLine: 'Within that, what matters most to you? Pick one or two.',
    Body: GoalsBody,
    voiceEngine: 'MP3',
    voiceNote: 'Pre-recorded opener',
  },
  {
    id: 'habits',
    name: 'Habit picker',
    coachLine: 'Pick one or two to start. One is plenty, the check-in is already a habit.',
    Body: HabitsBody,
    voiceEngine: 'MP3',
    voiceNote: 'MP3 opener + Vapi available',
  },
  {
    id: 'reflection',
    name: 'Evening reflection',
    coachLine: 'And your evening reflection. How do you want to do it, and when?',
    Body: ReflectionBody,
    voiceEngine: 'MP3',
    voiceNote: 'Pre-recorded opener',
  },
  {
    id: 'plan',
    name: 'Full plan',
    coachLine: "Here's your plan. Morning check-in, evening reflection, and your habits. Approve and you're in.",
    Body: PlanBody,
    voiceEngine: 'MP3',
    voiceNote: 'Pre-recorded verbatim',
  },
  {
    id: 'checkin',
    name: 'State check',
    coachLine: 'How are you landing right now?',
    Body: CheckinBody,
    voiceEngine: 'MP3',
    voiceNote: 'Pre-recorded opener',
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
          Real components, real content. Voice delivery annotated in the right margin.
        </p>
      </div>

      {/* Legend */}
      <div style={{ maxWidth: 720, margin: '0 auto 8px' }}>
        <VoiceLegend />
      </div>

      {/* Main layout: phone centered, badge column in right margin */}
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 20,
        }}
      >
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

          {/* Beat stream */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              padding: '24px 20px',
              background: '#f9f9f9',
            }}
          >
            {BEATS.map((b) => {
              const Body = b.Body;
              return (
                <div
                  key={b.id}
                  data-beat-id={b.id}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  {/* Beat label (inside phone, above coach bubble) */}
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#94a3b8',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      paddingBottom: 2,
                    }}
                  >
                    {b.name}
                  </div>
                  {/* Coach bubble */}
                  <div
                    style={{
                      marginRight: 'auto',
                      maxWidth: 290,
                      borderRadius: '16px 16px 16px 4px',
                      background: '#f1f5f9',
                      padding: '12px 16px',
                      fontSize: 15,
                      lineHeight: 1.4,
                      color: '#1e293b',
                    }}
                  >
                    {b.coachLine}
                  </div>
                  {/* Component body */}
                  <Body />
                  {/* User reply bubble (if any) */}
                  {b.reply && (
                    <div
                      style={{
                        marginLeft: 'auto',
                        maxWidth: 280,
                        borderRadius: '16px 16px 4px 16px',
                        background: '#6366f1',
                        padding: '12px 16px',
                        fontSize: 15,
                        fontWeight: 500,
                        lineHeight: 1.4,
                        color: '#fff',
                      }}
                    >
                      {b.reply}
                    </div>
                  )}
                </div>
              );
            })}
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

        {/* Voice engine badge column (outside the phone) */}
        <div
          style={{
            flex: '1 1 140px',
            display: 'flex',
            flexDirection: 'column',
            // paddingTop matches: status-bar height (53px) + gap between status bar and first beat label
            // Status bar: ~53px. Then 24px padding-top, then beat-label (~18px), then coach bubble starts.
            // Aligning to the coach bubble's top for the first beat.
            paddingTop: 95,
            gap: 0,
          }}
        >
          {BEATS.map((b) => (
            <BeatBadgeSlot key={b.id} engine={b.voiceEngine} note={b.voiceNote} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Each badge slot uses a fixed height that approximates the rendered height of its beat.
// These are rough but visually aligned because FlowDesigner is a continuous scroll,
// not a per-screen layout. The badge sits beside the coach bubble for each beat.
const BEAT_SLOT_HEIGHTS: Record<string, number> = {
  profile: 230,
  category: 320,
  goals: 200,
  habits: 200,
  reflection: 200,
  plan: 180,
  checkin: 150,
};

function BeatBadgeSlot({
  engine,
  note,
}: {
  engine: VoiceEngine;
  note?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        paddingTop: 30,
        minHeight: 80,
      }}
    >
      <VoiceEngineBadge engine={engine} note={note} />
    </div>
  );
}
