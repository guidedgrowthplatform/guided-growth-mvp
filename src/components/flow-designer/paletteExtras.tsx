import { Icon } from '@iconify/react';
import { useState, type ReactNode } from 'react';
import type { MetricType } from '@/components/calendar/calendarConfig';
import { metricConfigs } from '@/components/calendar/calendarConfig';
import { CalendarDayCell } from '@/components/calendar/CalendarDayCell';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { CalendarLegend } from '@/components/calendar/CalendarLegend';
import { MetricSegmentedControl } from '@/components/calendar/MetricSegmentedControl';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { MarkdownMessage } from '@/components/chat/MarkdownMessage';
import { FocusControls } from '@/components/focus/FocusControls';
import { FocusTimer } from '@/components/focus/FocusTimer';
import { TimePicker as FocusWheelPicker } from '@/components/focus/ScrollWheelPicker';
import { DaySchedulePills } from '@/components/habit-detail/DaySchedulePills';
import { HabitDetailTitle, HabitDetailTopBar } from '@/components/habit-detail/HabitDetailHeader';
import { MilestoneBadge } from '@/components/habit-detail/MilestoneBadge';
import { MilestonesSection } from '@/components/habit-detail/MilestonesSection';
import { ReflectionCard as HabitDetailReflectionCard } from '@/components/habit-detail/ReflectionCard';
import { StatsGrid } from '@/components/habit-detail/StatsGrid';
import { StreakCalendarGrid } from '@/components/habit-detail/StreakCalendarGrid';
import { StreakCard } from '@/components/habit-detail/StreakCard';
import { checkInDimensions } from '@/components/home/checkInConfig';
import { EmojiOptionButton } from '@/components/home/EmojiOptionButton';
import { FeedbackButton } from '@/components/home/FeedbackButton';
import { IconCircleButton } from '@/components/home/IconCircleButton';
import { OpenChatButton } from '@/components/home/OpenChatButton';
import { SectionHeader } from '@/components/home/SectionHeader';
import { BarChart } from '@/components/insights/BarChart';
import { CheckInDateGroup } from '@/components/insights/CheckInDateGroup';
import { CheckInEntryCard } from '@/components/insights/CheckInEntryCard';
import { CheckInHistoryTab } from '@/components/insights/CheckInHistoryTab';
import { DateFilterBar } from '@/components/insights/DateFilterBar';
import { HabitCompletionCard } from '@/components/insights/HabitCompletionCard';
import { HabitPerformanceList } from '@/components/insights/HabitPerformanceList';
import { HabitProgressRing } from '@/components/insights/HabitProgressRing';
import { SegmentedControl } from '@/components/insights/SegmentedControl';
import { GuidedTab } from '@/components/journal/GuidedTab';
import { NotificationCard } from '@/components/notifications/NotificationCard';
import { WeeklySummaryCard } from '@/components/notifications/WeeklySummaryCard';
import { AiListeningTooltip } from '@/components/onboarding/AiListeningTooltip';
import { GoalTextarea } from '@/components/onboarding/GoalTextarea';
import { GuidanceBadge } from '@/components/onboarding/GuidanceBadge';
import { HabitCustomizeSheet } from '@/components/onboarding/HabitCustomizeSheet';
import { OnboardingSection } from '@/components/onboarding/OnboardingSection';
import { OnboardingTooltip } from '@/components/onboarding/OnboardingTooltip';
import { VoiceTooltip } from '@/components/onboarding/VoiceTooltip';
import { ConfirmDialog } from '@/components/settings/ConfirmDialog';
import { SettingRow } from '@/components/settings/SettingRow';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { TimeBadge } from '@/components/settings/TimeBadge';
import { UserInfoSection } from '@/components/settings/UserInfoSection';
import { AuthAlert } from '@/components/auth/AuthAlert';
import { AuthResultScreen } from '@/components/auth/AuthResultScreen';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { InfoBox } from '@/components/ui/InfoBox';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Select } from '@/components/ui/Select';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { TimePicker } from '@/components/ui/TimePicker';
import { OrbControls } from '@/components/voice/OrbControls';
import { DayPicker as VoiceDayPicker } from '@/components/voice/DayPicker';
import { VoiceCapModal } from '@/components/voice/VoiceCapModal';
import { SignInScreen } from '@/components/welcome/SignInScreen';
import { VoiceCone } from '@/components/welcome/VoiceCone';
import type { CalendarCell } from '@/hooks/useHabitDetail';
import { CheckCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

export type PaletteEntry = {
  type: string;
  group: string;
  label: string;
  Comp: (props?: Record<string, string>) => ReactNode;
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function AuthAlertPreview() {
  return <AuthAlert type="success" message="Check your email for the magic link." />;
}

function AuthResultScreenPreview() {
  return (
    <div className="h-[360px] overflow-hidden rounded-2xl">
      <AuthResultScreen
        title="Email verified"
        body="You can continue building your plan."
        primaryLabel="Continue"
        secondaryLabel="Back to login"
        onPrimary={() => {}}
        onSecondary={() => {}}
        iconName="mdi:check-circle-outline"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

const SAMPLE_MONTH = new Date(2026, 5, 1);
const SAMPLE_CAL_DATA: Record<string, { mood?: number; sleep?: number; energy?: number; stress?: number }> = {
  '2026-06-01': { mood: 4, sleep: 3, energy: 4, stress: 2 },
  '2026-06-02': { mood: 3, sleep: 4, energy: 3, stress: 3 },
  '2026-06-03': { mood: 5, sleep: 5, energy: 5, stress: 1 },
  '2026-06-04': { mood: 2, sleep: 2, energy: 2, stress: 4 },
  '2026-06-05': { mood: 4, sleep: 4, energy: 4, stress: 2 },
};

function CalendarDayCellPreview() {
  return (
    <div className="flex justify-center">
      <CalendarDayCell
        day={24}
        value={4}
        levelConfig={metricConfigs.sleep.levels[4]}
        isSelected
        onClick={() => {}}
      />
    </div>
  );
}

function CalendarLegendPreview() {
  return <CalendarLegend metricType="sleep" />;
}

function CalendarHeaderPreview() {
  const [m, setM] = useState(SAMPLE_MONTH);
  return (
    <CalendarHeader
      month={m}
      onPrev={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))}
      onNext={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))}
    />
  );
}

function CalendarGridPreview() {
  const [selectedDay, setSelectedDay] = useState<number | null>(3);
  return (
    <CalendarGrid
      month={SAMPLE_MONTH}
      data={SAMPLE_CAL_DATA}
      activeMetric="sleep"
      selectedDay={selectedDay}
      onSelectDay={setSelectedDay}
    />
  );
}

function MetricSegmentedControlPreview() {
  const [v, setV] = useState<MetricType>('sleep');
  return <MetricSegmentedControl value={v} onChange={setV} />;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

function ChatComposerPreview() {
  return <ChatComposer onSubmit={() => {}} placeholder="Type a message..." />;
}

function MarkdownMessagePreview() {
  return (
    <div className="rounded-2xl bg-surface p-4 text-[15px] text-content">
      <MarkdownMessage text={"**Great work.** Next:\n- Sleep earlier\n- Cut caffeine"} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Focus
// ---------------------------------------------------------------------------

function FocusControlsPreview() {
  return (
    <div className="flex justify-center">
      <FocusControls status="idle" onStart={() => {}} onPause={() => {}} onResume={() => {}} onStop={() => {}} />
    </div>
  );
}

function FocusWheelPickerPreview() {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  return (
    <FocusWheelPicker
      hours={hours}
      minutes={minutes}
      seconds={seconds}
      onChangeHours={setHours}
      onChangeMinutes={setMinutes}
      onChangeSeconds={setSeconds}
      hourValues={Array.from({ length: 4 }, (_, i) => i)}
      minuteValues={[0, 5, 10, 15, 20, 25, 30, 45]}
      secondValues={[0, 15, 30, 45]}
    />
  );
}

function FocusTimerPreview() {
  return (
    <div className="flex justify-center">
      <FocusTimer remainingSeconds={1500} progress={0.75} status="running" onEditPress={() => {}} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Habit detail
// ---------------------------------------------------------------------------

function HabitDetailTopBarPreview() {
  return <HabitDetailTopBar onClose={() => {}} onDelete={() => {}} />;
}

function HabitDetailTitlePreview() {
  return <HabitDetailTitle name="No screens after 10 PM" description="Wind down earlier and protect sleep quality." />;
}

function HabitDetailReflectionPreview() {
  return <HabitDetailReflectionCard habitName="No screens after 10 PM" onLogReflection={() => {}} />;
}

function StatsGridPreview() {
  return <StatsGrid completionRate={82} currentStreak={6} longestStreak={14} failedDays={3} />;
}

const STATIC_CAL: CalendarCell[][] = (() => {
  const statuses: CalendarCell['status'][] = [
    'done', 'done', 'missed', 'done', 'done', 'done', 'unscheduled-past',
    'done', 'done', 'done', 'missed', 'done', 'done', 'unscheduled-past',
    'done', 'done', 'done', 'done', 'done', 'missed', 'unscheduled-past',
    'done', 'today-done', 'scheduled-future', 'scheduled-future', 'scheduled-future', 'scheduled-future', 'unscheduled-future',
  ];
  const weeks: CalendarCell[][] = [];
  for (let w = 0; w < 4; w++) {
    weeks.push(
      Array.from({ length: 7 }, (_, d) => ({
        status: statuses[w * 7 + d],
        day: w * 7 + d + 1,
      }))
    );
  }
  return weeks;
})();

function StreakCalendarGridPreview() {
  return <StreakCalendarGrid data={STATIC_CAL} />;
}

function StreakCardPreview() {
  return (
    <StreakCard
      currentStreak={6}
      calendarMonth="June"
      totalRepetitions={38}
      sinceDate="May 1"
      calendarData={STATIC_CAL}
    />
  );
}

function DaySchedulePillsPreview() {
  return <DaySchedulePills activeDays={[false, true, true, true, true, true, false]} frequencyLabel="Weekdays" />;
}

function MilestoneBadgePreview() {
  return (
    <div className="flex gap-4">
      <MilestoneBadge target={7} earned />
      <MilestoneBadge target={21} earned={false} />
    </div>
  );
}

function MilestonesSectionPreview() {
  return <MilestonesSection milestones={[{ target: 7, earned: true }, { target: 14, earned: true }, { target: 21, earned: false }]} />;
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

function MoodRow() {
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

function FeedbackButtonPreview() {
  return <FeedbackButton onPress={() => {}} />;
}

function IconCircleButtonPreview() {
  const [active, setActive] = useState(true);
  return <IconCircleButton icon={CheckCircle} active={active} onClick={() => setActive((v) => !v)} />;
}

function OpenChatButtonPreview() {
  return <OpenChatButton onPress={() => {}} />;
}

function SectionHeaderPreview() {
  return <SectionHeader title="Your Habits" actionLabel="See all" onAction={() => {}} />;
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

const BAR_DATA = [
  { label: 'Mon', value: 80 },
  { label: 'Tue', value: 60 },
  { label: 'Wed', value: 100 },
  { label: 'Thu', value: 75 },
  { label: 'Fri', value: 50 },
  { label: 'Sat', value: 90 },
  { label: 'Sun', value: 70 },
];

function BarChartPreview() {
  return <BarChart data={BAR_DATA} />;
}

function CheckInDateGroupPreview() {
  return (
    <CheckInDateGroup
      month="JUN"
      day={24}
      dayName="Wednesday"
      daysAgo="Today"
      entries={[{ title: 'Morning', time: '7:30 AM', iconBg: 'bg-primary/10', variant: 'detailed', metrics: [{ icon: 'mdi:weather-sunny', label: 'Mood: Good' }, { icon: 'mdi:lightning-bolt', label: 'Energy: High' }] }]}
    />
  );
}

function CheckInEntryPreview() {
  return <CheckInEntryCard title="Morning" time="7:30 AM" iconBg="bg-primary/10" variant="detailed" metrics={[{ icon: 'mdi:weather-sunny', label: 'Mood: Good' }, { icon: 'mdi:lightning-bolt', label: 'Energy: High' }]} notes="Felt clear after a short walk." />;
}

function CheckInHistoryTabPreview() {
  const [selectedMonth, setSelectedMonth] = useState('June 2026');
  return (
    <CheckInHistoryTab
      history={{
        groups: [{ month: 'JUN', day: 24, dayName: 'Wednesday', daysAgo: 'Today', entries: [{ title: 'Morning', time: '7:30 AM', iconBg: 'bg-primary/10', variant: 'compact', metrics: [{ icon: 'mdi:emoticon-happy', label: 'Mood: Good' }] }] }],
        availableMonths: ['June 2026', 'May 2026'],
        selectedMonth,
        setSelectedMonth,
        isLoading: false,
        error: null,
      } as never}
    />
  );
}

function DateFilterBarPreview() {
  const [v, setV] = useState('June 2026');
  return <DateFilterBar availableMonths={['June 2026', 'May 2026']} selected={v} onSelect={setV} />;
}

function HabitCompletionCardPreview() {
  return <HabitCompletionCard timeRange="week" completionByRange={{ week: { percentage: 82, trend: '12%', trendPositive: true, subtitle: 'this week', bars: BAR_DATA } }} />;
}

function HabitPerformanceListPreview() {
  return <HabitPerformanceList habits={[{ name: 'Morning walk', percentage: 86, streak: '6 day streak', bestDay: 'Wednesday', totalCompletions: 18, weeklyData: [60, 80, 90, 70, 85, 95, 80] }, { name: 'Read before bed', percentage: 62, streak: '3 day streak', bestDay: 'Monday', totalCompletions: 11, weeklyData: [40, 50, 65, 60, 75, 55, 62] }]} />;
}

function HabitProgressRingPreview() {
  return (
    <div className="flex items-center gap-3">
      <HabitProgressRing percentage={72} size={56} />
      <span className="text-sm font-semibold text-content">72% completion</span>
    </div>
  );
}

function SegmentedControlPreview() {
  const [v, setV] = useState('week');
  return <SegmentedControl items={[{ label: 'Week', value: 'week' }, { label: 'Month', value: 'month' }]} value={v} onChange={setV} size="sm" />;
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

function GuidedTabPreview() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return <GuidedTab answers={answers} onAnswerChange={(i, v) => setAnswers((prev) => ({ ...prev, [String(i)]: v }))} onSave={() => {}} saving={false} now={new Date(2026, 5, 24, 9)} />;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

function NotificationCardPreview() {
  return <NotificationCard notification={{ id: 'n1', category: 'habit', icon: 'mdi:bell-outline', iconClass: 'text-primary', iconBg: 'bg-primary/10', title: 'Reflection ready', body: 'Your evening reflection is waiting.', createdAt: new Date().toISOString(), unread: true, cta: { label: 'Open', to: '/journal' } }} onPress={() => {}} onCtaPress={() => {}} />;
}

function WeeklySummaryCardPreview() {
  return <WeeklySummaryCard onViewReport={() => {}} />;
}

// ---------------------------------------------------------------------------
// Onboarding extras
// ---------------------------------------------------------------------------

function AiListeningTooltipPreview() {
  return <AiListeningTooltip text="Tell me about your current routine." visible />;
}

function GoalTextareaPreview() {
  const [v, setV] = useState('');
  return <GoalTextarea value={v} onChange={setV} />;
}

function GuidanceBadgePreview() {
  return <GuidanceBadge text="AI Guided Setup" />;
}

function HabitCustomizeSheetPreview() {
  return <HabitCustomizeSheet habitName="No screens after 10 PM" onClose={() => {}} onNext={() => {}} isLastHabit={false} />;
}

function OnboardingSectionPreview() {
  return (
    <OnboardingSection label="What are your goals?">
      <div className="rounded-xl bg-surface-secondary p-4 text-sm text-content-secondary">
        Goal cards go here
      </div>
    </OnboardingSection>
  );
}

function OnboardingTooltipPreview() {
  return <OnboardingTooltip title="Why we ask" message="Your answers help us build a personalized plan that actually fits your life." />;
}

function VoiceTooltipPreview() {
  return <VoiceTooltip autoDismissMs={999999} />;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function ConfirmDialogPreview() {
  return (
    <div className="relative h-64 overflow-hidden rounded-2xl">
      <ConfirmDialog
        title="Delete Habit"
        message="This action cannot be undone. Your streak and history will be lost."
        variant="danger"
        confirmLabel="Delete"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    </div>
  );
}

function SettingRowPreview() {
  return (
    <div className="rounded-2xl bg-surface overflow-hidden">
      <SettingRow icon="ic:round-bell" label="Notifications" isFirst />
    </div>
  );
}

function SettingsCardPreview() {
  return (
    <SettingsCard>
      <SettingRow icon="ic:round-bell" label="Notifications" isFirst />
      <SettingRow icon="ic:round-lock" label="Privacy" />
    </SettingsCard>
  );
}

function SettingsHeaderPreview() {
  return <SettingsHeader onBack={() => {}} onMenu={() => {}} />;
}

function TimeBadgePreview() {
  return <TimeBadge>9:30 PM</TimeBadge>;
}

function UserInfoSectionPreview() {
  return <UserInfoSection name="Jordan Lee" email="jordan@example.com" nickname="jordan" />;
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

function BadgePreview() {
  return <Badge variant="success">7-day streak</Badge>;
}

function CardPreview() {
  return (
    <Card>
      <p className="text-sm text-content">A simple card container with default padding and border.</p>
    </Card>
  );
}

function InfoBoxPreview() {
  return (
    <InfoBox icon={<Icon icon="mdi:lightbulb-outline" className="size-5" />}>
      Building a new habit takes about 66 days on average. Stay consistent.
    </InfoBox>
  );
}

function InputPreview() {
  const [v, setV] = useState('');
  return <Input label="Email" placeholder="you@example.com" value={v} onChange={(e) => setV(e.target.value)} />;
}

function LoadingSpinnerPreview() {
  return (
    <div className="flex items-center gap-3">
      <LoadingSpinner size="md" />
      <span className="text-sm text-content-secondary">Loading...</span>
    </div>
  );
}

function SelectPreview() {
  const [v, setV] = useState('morning');
  return (
    <Select
      label="Preferred time"
      value={v}
      onChange={(e) => setV(e.target.value)}
      options={[
        { value: 'morning', label: 'Morning' },
        { value: 'afternoon', label: 'Afternoon' },
        { value: 'evening', label: 'Evening' },
      ]}
    />
  );
}

function ThemeTogglePreview() {
  return <ThemeToggle />;
}

function TimePickerPreview() {
  const [v, setV] = useState('21:30');
  return <TimePicker value={v} onChange={setV} />;
}

// ---------------------------------------------------------------------------
// Voice / Orb
// ---------------------------------------------------------------------------

function OrbControlsPreview() {
  return (
    <div className="flex justify-center py-2">
      <OrbControls
        size={120}
        leftActive
        rightActive={false}
        activeRings={null}
        ringCount={3}
        ringStep={7}
        micAllowed
        onToggleVoice={() => {}}
        onToggleMic={() => {}}
        onRequestMic={() => {}}
      />
    </div>
  );
}

function HabitDaysPickerPreview() {
  const [days, setDays] = useState<boolean[]>([false, true, true, true, true, true, false]);
  return <VoiceDayPicker days={days} onChange={setDays} />;
}

function VoiceCapModalPreview() {
  return (
    <div className="relative h-64 overflow-hidden rounded-2xl">
      <VoiceCapModal />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Welcome / Intro
// ---------------------------------------------------------------------------

function SignInScreenPreview() {
  return (
    <div style={{ position: 'relative', width: '100%', height: 520, overflow: 'hidden', borderRadius: 24 }}>
      <SignInScreen onApple={() => {}} onGoogle={() => {}} onSignUp={() => {}} />
    </div>
  );
}

function VoiceConePreview() {
  return (
    <div className="relative h-36 rounded-2xl bg-surface-secondary">
      <VoiceCone active intensity={0.8} orbRadius={45} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Registry export
// ---------------------------------------------------------------------------

export const EXTRA_REGISTRY: PaletteEntry[] = [
  // Auth
  { type: 'auth-alert', group: 'Auth', label: 'Auth alert', Comp: AuthAlertPreview },
  { type: 'auth-result-screen', group: 'Auth', label: 'Auth result', Comp: AuthResultScreenPreview },

  // Calendar
  { type: 'calendar-day-cell', group: 'Calendar', label: 'Calendar day', Comp: CalendarDayCellPreview },
  { type: 'calendar-legend', group: 'Calendar', label: 'Calendar legend', Comp: CalendarLegendPreview },
  { type: 'calendar-header', group: 'Calendar', label: 'Calendar header', Comp: CalendarHeaderPreview },
  { type: 'calendar-grid', group: 'Calendar', label: 'Calendar grid', Comp: CalendarGridPreview },
  { type: 'metric-segmented-control', group: 'Calendar', label: 'Metric control', Comp: MetricSegmentedControlPreview },

  // Chat
  { type: 'chat-composer', group: 'Chat', label: 'Chat composer', Comp: ChatComposerPreview },
  { type: 'markdown-message', group: 'Chat', label: 'Markdown message', Comp: MarkdownMessagePreview },

  // Focus
  { type: 'focus-controls', group: 'Focus', label: 'Focus controls', Comp: FocusControlsPreview },
  { type: 'focus-wheel-picker', group: 'Focus', label: 'Focus time picker', Comp: FocusWheelPickerPreview },
  { type: 'focus-timer', group: 'Focus', label: 'Focus timer', Comp: FocusTimerPreview },

  // Habit detail
  { type: 'habit-detail-topbar', group: 'Habit', label: 'Habit top bar', Comp: HabitDetailTopBarPreview },
  { type: 'habit-detail-title', group: 'Habit', label: 'Habit title', Comp: HabitDetailTitlePreview },
  { type: 'habit-detail-reflection', group: 'Habit', label: 'Habit reflection', Comp: HabitDetailReflectionPreview },
  { type: 'stats-grid', group: 'Habit', label: 'Stats grid', Comp: StatsGridPreview },
  { type: 'streak-calendar-grid', group: 'Habit', label: 'Streak calendar', Comp: StreakCalendarGridPreview },
  { type: 'streak-card', group: 'Habit', label: 'Streak card', Comp: StreakCardPreview },
  { type: 'day-schedule-pills', group: 'Habit', label: 'Day schedule pills', Comp: DaySchedulePillsPreview },
  { type: 'milestone-badge', group: 'Habit', label: 'Milestone badge', Comp: MilestoneBadgePreview },
  { type: 'milestones-section', group: 'Habit', label: 'Milestones', Comp: MilestonesSectionPreview },

  // Home extras
  { type: 'mood-emoji-row', group: 'Check-in', label: 'Mood emoji row', Comp: MoodRow },
  { type: 'feedback-button', group: 'Home', label: 'Feedback button', Comp: FeedbackButtonPreview },
  { type: 'icon-circle-button', group: 'Home', label: 'Icon circle', Comp: IconCircleButtonPreview },
  { type: 'open-chat-button', group: 'Home', label: 'Open chat', Comp: OpenChatButtonPreview },
  { type: 'section-header', group: 'Home', label: 'Section header', Comp: SectionHeaderPreview },

  // Insights
  { type: 'bar-chart', group: 'Insights', label: 'Bar chart', Comp: BarChartPreview },
  { type: 'checkin-date-group', group: 'Insights', label: 'Check-in date group', Comp: CheckInDateGroupPreview },
  { type: 'checkin-entry-card', group: 'Insights', label: 'Check-in entry', Comp: CheckInEntryPreview },
  { type: 'checkin-history-tab', group: 'Insights', label: 'Check-in history', Comp: CheckInHistoryTabPreview },
  { type: 'date-filter-bar', group: 'Insights', label: 'Date filter', Comp: DateFilterBarPreview },
  { type: 'habit-completion-card', group: 'Insights', label: 'Habit completion', Comp: HabitCompletionCardPreview },
  { type: 'habit-performance-list', group: 'Insights', label: 'Habit performance', Comp: HabitPerformanceListPreview },
  { type: 'habit-progress-ring', group: 'Insights', label: 'Progress ring', Comp: HabitProgressRingPreview },
  { type: 'segmented-control', group: 'Insights', label: 'Segmented control', Comp: SegmentedControlPreview },

  // Journal
  { type: 'guided-tab', group: 'Journal', label: 'Guided journal', Comp: GuidedTabPreview },

  // Notifications
  { type: 'notification-card', group: 'Notifications', label: 'Notification', Comp: NotificationCardPreview },
  { type: 'weekly-summary-card', group: 'Notifications', label: 'Weekly summary', Comp: WeeklySummaryCardPreview },

  // Onboarding extras
  { type: 'ai-listening-tooltip', group: 'Onboarding', label: 'AI listening', Comp: AiListeningTooltipPreview },
  { type: 'goal-textarea', group: 'Onboarding', label: 'Goal textarea', Comp: GoalTextareaPreview },
  { type: 'guidance-badge', group: 'Onboarding', label: 'Guidance badge', Comp: GuidanceBadgePreview },
  { type: 'habit-customize-sheet', group: 'Onboarding', label: 'Habit customize', Comp: HabitCustomizeSheetPreview },
  { type: 'onboarding-section', group: 'Onboarding', label: 'Onboarding section', Comp: OnboardingSectionPreview },
  { type: 'onboarding-tooltip', group: 'Onboarding', label: 'Onboarding tooltip', Comp: OnboardingTooltipPreview },
  { type: 'voice-tooltip', group: 'Onboarding', label: 'Voice tooltip', Comp: VoiceTooltipPreview },

  // Settings
  { type: 'confirm-dialog', group: 'Settings', label: 'Confirm dialog', Comp: ConfirmDialogPreview },
  { type: 'setting-row', group: 'Settings', label: 'Setting row', Comp: SettingRowPreview },
  { type: 'settings-card', group: 'Settings', label: 'Settings card', Comp: SettingsCardPreview },
  { type: 'settings-header', group: 'Settings', label: 'Settings header', Comp: SettingsHeaderPreview },
  { type: 'time-badge', group: 'Settings', label: 'Time badge', Comp: TimeBadgePreview },
  { type: 'user-info-section', group: 'Settings', label: 'User info', Comp: UserInfoSectionPreview },

  // UI
  { type: 'badge', group: 'UI', label: 'Badge', Comp: BadgePreview },
  { type: 'card', group: 'UI', label: 'Card', Comp: CardPreview },
  { type: 'info-box', group: 'UI', label: 'Info box', Comp: InfoBoxPreview },
  { type: 'input', group: 'UI', label: 'Input', Comp: InputPreview },
  { type: 'loading-spinner', group: 'UI', label: 'Loading spinner', Comp: LoadingSpinnerPreview },
  { type: 'select', group: 'UI', label: 'Select', Comp: SelectPreview },
  { type: 'theme-toggle', group: 'UI', label: 'Theme toggle', Comp: ThemeTogglePreview },
  { type: 'time-picker', group: 'UI', label: 'Time picker', Comp: TimePickerPreview },

  // Orb / Voice
  { type: 'orb-controls', group: 'Orb', label: 'Orb controls', Comp: OrbControlsPreview },
  { type: 'voice-day-picker', group: 'Orb', label: 'Voice day picker', Comp: HabitDaysPickerPreview },
  { type: 'voice-cap-modal', group: 'Orb', label: 'Voice cap modal', Comp: VoiceCapModalPreview },

  // Welcome / Intro
  { type: 'sign-in-screen', group: 'Intro', label: 'Sign-in screen', Comp: SignInScreenPreview },
  { type: 'voice-cone', group: 'Orb', label: 'Voice cone', Comp: VoiceConePreview },
];

export const EXTRA_GROUPS: string[] = [
  'Calendar',
  'Focus',
  'Habit',
  'Insights',
  'Journal',
  'Notifications',
  'Reflections',
  'Settings',
  'Welcome',
];
