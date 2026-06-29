import { Icon } from '@iconify/react';
import { useState, type ReactElement } from 'react';
import { checkInDimensions } from '@/components/home/checkInConfig';
import { EmojiOptionButton } from '@/components/home/EmojiOptionButton';
import { AgeScrollPicker } from '@/components/onboarding/AgeScrollPicker';
import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { DailyReflectionCard } from '@/components/onboarding/DailyReflectionCard';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { HabitPickerPanel } from '@/components/onboarding/HabitPickerPanel';
import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import type { ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { ChipSelect } from '@/components/ui/ChipSelect';

/**
 * FlowDesigner -- the chat-native onboarding flow as one continuous scroll,
 * built from the REAL app components (not lookalikes) with the v3 onboarding
 * content (coach lines and on-screen copy from the v3 beats spec).
 *
 * The chat flows continuously: a coach bubble, the real component, then the
 * next coach bubble. There are no machine section labels, it reads like the
 * real app.
 *
 * Voice engine badges sit OUTSIDE the phone frame, in the right margin,
 * aligned to each beat. Four kinds:
 *   MP3       -- pre-recorded verbatim clip (blue)
 *   Cartesia  -- live dynamic TTS, dynamic content (purple)
 *   Vapi      -- live two-way coaching session (green)
 *   Silent    -- no coach voice at this beat (gray)
 */

// --- Beat bodies: each holds its own local state and renders real components.

// Profile, v3: AGE + GENDER only. No name field (the name was captured at
// sign-up; the coach greets by it). Age scroll picker, then the gender chips.
function ProfileBody() {
  const [age, setAge] = useState<number | ''>(28);
  const [gender, setGender] = useState<string | null>('Male');
  return (
    <div className="flex flex-col gap-4">
      <AgeScrollPicker value={age} onChange={setAge} />
      <ChipSelect
        options={['Male', 'Female', 'Other']}
        value={gender}
        onChange={setGender}
        ariaLabel="And your gender?"
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

// Evening reflection, v3: style is one of "Suggested template" / "Your
// template" / "Freeform". The simple DailyReflectionCard has no style tabs, so
// a compact segmented control is added above it. Names match the v3 spec.
type ReflectionStyle = 'Suggested template' | 'Your template' | 'Freeform';
const REFLECTION_STYLES: { id: ReflectionStyle; icon: string }[] = [
  { id: 'Suggested template', icon: 'mdi:comment-question-outline' },
  { id: 'Your template', icon: 'mdi:pencil-outline' },
  { id: 'Freeform', icon: 'mdi:microphone-outline' },
];

function ReflectionBody() {
  const [style, setStyle] = useState<ReflectionStyle>('Suggested template');
  const [time, setTime] = useState('21:30');
  const [days, setDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
  const [reminder, setReminder] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleOption>('Every day');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {REFLECTION_STYLES.map((s) => {
          const active = s.id === style;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl border px-2 py-2.5 text-[12px] font-semibold ${
                active
                  ? 'border-primary bg-primary text-white'
                  : 'border-border-light bg-surface-secondary text-content-secondary'
              }`}
            >
              <Icon icon={s.icon} className="size-3.5 shrink-0" />
              {s.id}
            </button>
          );
        })}
      </div>
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
    </div>
  );
}

function PlanBody() {
  return (
    <div className="flex flex-col gap-3">
      <PlanSummaryCard
        icon="mdi:weather-sunny"
        typeLabel="Journal"
        title="Daily check-in"
        cadence="Every day"
        rule="8:00 AM"
        onEdit={() => {}}
      />
      <PlanSummaryCard
        icon="mdi:notebook-outline"
        typeLabel="Journal"
        title="Evening reflection"
        cadence="Every day"
        rule="9:30 PM"
        onEdit={() => {}}
      />
      <PlanSummaryCard
        icon="mdi:bed-outline"
        typeLabel="Habit"
        title="No screens after 10 PM"
        cadence="Every day"
        rule="10:00 PM"
        onEdit={() => {}}
      />
    </div>
  );
}

// Morning check-in, v3: the user does a state check right now. The mood row is
// the real check-in card row.
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

// Beginner per-habit schedule body, the days + time controls inline.
function ScheduleBody() {
  const [days, setDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-surface-secondary p-4">
      <span className="text-[13px] font-bold text-content">No screens after 10 PM</span>
      <div className="flex justify-between">
        {labels.map((l, i) => {
          const on = days.has(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() =>
                setDays((prev) => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  return next;
                })
              }
              className={`flex size-9 items-center justify-center rounded-full text-[13px] font-bold ${
                on ? 'bg-primary text-white' : 'bg-surface text-content-tertiary'
              }`}
            >
              {l}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-primary bg-surface px-4 py-3">
        <span className="text-[14px] font-bold text-content">10:00 PM</span>
        <Icon icon="ic:round-access-time" className="size-5 text-primary" />
      </div>
    </div>
  );
}

// Splash, get-started, sign-up, mic, why-intro: chat-stream stand-ins. The real
// app renders these as full screens; in the continuous scroll they show their
// on-screen heading + sub so the order reads true.

function SplashBody() {
  return <ScreenStub eyebrow="Behavioral OS" heading="Guided Growth" icon="ic:round-auto-awesome" />;
}

function GetStartedBody() {
  return (
    <ScreenStub
      eyebrow="Behavioral OS"
      heading="Guided Growth"
      icon="ic:round-auto-awesome"
      primary="Get started"
      secondary="I already have an account"
    />
  );
}

function SignupBody() {
  return (
    <ScreenStub
      heading="Create your account"
      icon="mdi:account-plus-outline"
      primary="Continue with Apple"
      secondary="Continue with Google"
      sub="or sign up with email"
    />
  );
}

function MicBody() {
  return (
    <ScreenStub
      heading="Talk with your coach"
      sub="Turn on your mic to talk out loud. You can always type instead."
      icon="ic:round-mic"
      primary="Turn on mic"
      secondary="Maybe later"
    />
  );
}

function WhyIntroBody() {
  return (
    <ScreenStub
      heading="Your first habit"
      sub="Checking in with yourself. Simple, and it carries everything else."
      icon="mdi:heart-outline"
    />
  );
}

// A simple, app-styled stand-in for a full screen, shown inline in the chat
// stream. Centered card with an icon, a heading, an optional sub, and up to two
// buttons styled like the real app's primary / secondary.
function ScreenStub({
  eyebrow,
  heading,
  sub,
  icon,
  primary,
  secondary,
}: {
  eyebrow?: string;
  heading: string;
  sub?: string;
  icon: string;
  primary?: string;
  secondary?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border-light bg-surface-secondary px-5 py-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <Icon icon={icon} className="size-6 text-primary" />
      </div>
      {eyebrow && (
        <span className="text-[11px] font-semibold uppercase tracking-wide text-content-tertiary">
          {eyebrow}
        </span>
      )}
      <span className="text-[18px] font-bold text-content">{heading}</span>
      {sub && <span className="max-w-[260px] text-[14px] text-content-tertiary">{sub}</span>}
      {primary && (
        <div className="mt-1 w-full rounded-full bg-primary px-4 py-2.5 text-[14px] font-semibold text-white">
          {primary}
        </div>
      )}
      {secondary && (
        <span className="text-[13px] font-medium text-content-secondary">{secondary}</span>
      )}
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

function VoiceEngineBadge({ engine, note }: { engine: VoiceEngine; note?: string }) {
  const m = ENGINE_META[engine];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 3,
        minWidth: 108,
        maxWidth: 150,
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
        <span style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.3, paddingLeft: 2 }}>
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

// --- Beat data, v3 order and copy ---

interface Beat {
  id: string;
  coachLine?: string;
  Body?: () => ReactElement;
  reply?: string;
  voiceEngine: VoiceEngine;
  voiceNote?: string;
}

const BEATS: Beat[] = [
  // 1. Splash. Silent.
  { id: 'splash', Body: SplashBody, voiceEngine: 'Silent' },
  // 2. Get Started. Silent.
  { id: 'get-started', Body: GetStartedBody, voiceEngine: 'Silent' },
  // 3. Coach Greeting. The orb blooms and speaks, MP3.
  {
    id: 'coach-greeting',
    coachLine:
      "Hey. I'm your coach inside Guided Growth. Give me two minutes and we'll set up something that actually sticks.",
    voiceEngine: 'MP3',
    voiceNote: 'splash_welcome.mp3',
  },
  // 4. Sign Up. Silent form, the name is captured here.
  { id: 'signup', Body: SignupBody, voiceEngine: 'Silent' },
  // 5. Mic Permission. MP3.
  {
    id: 'mic',
    coachLine:
      "I'd love to actually talk with you. If you let me use your mic, you can just speak. You can always type instead.",
    Body: MicBody,
    voiceEngine: 'MP3',
    voiceNote: 'Verbatim opener',
  },
  // 6. Profile. Age + gender. Greet by name, dynamic via Cartesia.
  {
    id: 'profile',
    coachLine: 'Good to meet you, Yair. Two quick things so I can tailor this to you. How old are you?',
    Body: ProfileBody,
    voiceEngine: 'Cartesia',
    voiceNote: 'Greets by name, dynamic',
  },
  // 7. Why intro. MP3.
  {
    id: 'why-intro',
    coachLine:
      "Here's the idea. The first habit isn't a workout or a diet. It's just checking in with yourself. It takes a minute, and it changes everything else. Let's start yours right now.",
    Body: WhyIntroBody,
    voiceEngine: 'MP3',
    voiceNote: 'Verbatim, candidate MP3',
  },
  // 8. Morning check-in. State card now, then set the daily time. MP3 opener.
  {
    id: 'checkin',
    coachLine:
      "Let's do your first check-in right now. How are you landing in this moment? Mood, energy, sleep, anything on you.",
    Body: CheckinBody,
    reply: 'Honestly pretty good, slept well for once.',
    voiceEngine: 'MP3',
    voiceNote: 'MP3 opener + Vapi reaction',
  },
  // 9. Evening reflection setup, configured only. MP3 opener + silent options.
  {
    id: 'reflection',
    coachLine:
      'One more. An evening reflection, a couple of minutes to close the day. How do you want to do it, and when?',
    Body: ReflectionBody,
    voiceEngine: 'MP3',
    voiceNote: 'Opener MP3, options silent',
  },
  // 10. Path fork. MP3.
  {
    id: 'fork',
    coachLine: 'Quick one. Have you tracked habits before, or is this new for you? Either way is great.',
    voiceEngine: 'MP3',
    voiceNote: 'Verbatim opener',
  },
  // 11. Beginner, category. MP3 opener + silent options + Vapi if unsure.
  {
    id: 'category',
    coachLine:
      'What part of your life do you most want to work on right now? Pick the one that pulls you.',
    Body: CategoryBody,
    voiceEngine: 'MP3',
    voiceNote: 'Opener MP3 + Vapi if unsure',
  },
  // 12. Beginner, subcategory. MP3 opener + silent options.
  {
    id: 'goals',
    coachLine: "Within that, what's the piece you want to start with?",
    Body: GoalsBody,
    voiceEngine: 'MP3',
    voiceNote: 'Opener MP3, options silent',
  },
  // 13. Beginner, habits. MP3 opener + silent options + Vapi.
  {
    id: 'habits',
    coachLine:
      "Pick the habits that feel doable. Not impressive, just doable. One you'll actually keep beats five you won't. Make your own if nothing here fits.",
    Body: HabitsBody,
    voiceEngine: 'MP3',
    voiceNote: 'MP3 opener + Vapi available',
  },
  // 14. Beginner, per-habit schedule. Vapi (live config).
  {
    id: 'schedule',
    coachLine: 'When will you do each one? Pick the days and a time. A reminder only if you want a nudge.',
    Body: ScheduleBody,
    voiceEngine: 'Vapi',
    voiceNote: 'Live per-habit config',
  },
  // 17. Full plan, the one confirm. MP3.
  {
    id: 'plan',
    coachLine:
      "Here's your plan. Your check-in, your reflection, and the habits you picked. Want to start here, or change anything first?",
    Body: PlanBody,
    voiceEngine: 'MP3',
    voiceNote: 'Verbatim opener',
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
          Real components, v3 content. Voice delivery annotated in the right margin.
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

          {/* Beat stream, continuous */}
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
                  {/* Coach bubble */}
                  {b.coachLine && (
                    <div
                      style={{
                        marginRight: 'auto',
                        maxWidth: 300,
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
                  )}
                  {/* Component body */}
                  {Body && <Body />}
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
            flex: '1 1 150px',
            display: 'flex',
            flexDirection: 'column',
            // Align the first badge to roughly the first coach bubble:
            // status bar (~53px) + stream padding (24px) + a little.
            paddingTop: 90,
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

// Each badge slot is a fixed-height row beside its beat. FlowDesigner is a
// continuous scroll, not a per-screen layout, so the badges are approximately
// aligned to their beats rather than pixel-locked.
function BeatBadgeSlot({ engine, note }: { engine: VoiceEngine; note?: string }) {
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
