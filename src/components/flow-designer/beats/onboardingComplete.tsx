import { Clock, Pencil } from 'lucide-react';
import { HabitScheduleCard, type HabitPolarity } from '@/components/onboarding/HabitScheduleCard';
import { Button } from '@/components/ui/Button';
import { DayPicker } from '@/components/ui/DayPicker';
import { formatTime12 } from '@/components/ui/TimePicker';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';
import { FONT, PRIMARY, SECTION_LABEL, SPACE } from './_beatStyle';
import { ritualWeekdaysForLocale } from './ritualCadence';

// The one full-plan confirm. Redesigned 2026-06-29: every item in the plan shows
// as the same card the schedule uses (HabitScheduleCard shape): the name, a time
// chip, and the read-only day circles. The three rituals (morning check-in,
// evening habit report, evening reflection) use the user's local work week, with
// weekends off by default; user habits show the days and time they picked.

const SAMPLE_HABITS = ['Morning walk', 'No screens after 10 PM'];
const noop = () => undefined;

// The rituals (morning check-in, evening habit report, evening reflection): the
// name, a time chip, an edit pencil, and the read-only day circles. No Build/Break
// and no delete, these are the fixed spine, not user habits.
function PlanCard({ name, days, time }: { name: string; days: Set<number>; time?: string }) {
  return (
    <div className="w-full overflow-clip rounded-[20px] border-2 border-primary bg-surface p-[2px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)]">
      <div className="px-[16px] pb-[10px] pt-[12px]">
        <div className="flex items-center justify-between gap-[8px]">
          <span className="min-w-0 flex-1 text-[15px] font-bold leading-[20px] text-content">
            {name}
          </span>
          <div className="flex shrink-0 items-center gap-[4px]">
            {time && (
              <span className="flex shrink-0 items-center gap-[4px] rounded-full border border-primary/30 bg-primary/10 px-[8px] py-[3px] text-[11px] font-semibold text-primary">
                <Clock className="size-[12px]" />
                {time}
              </span>
            )}
            <button
              type="button"
              aria-label={`Edit ${name}`}
              className="flex size-[26px] shrink-0 items-center justify-center rounded-lg text-primary"
            >
              <Pencil className="size-[17px]" />
            </button>
          </div>
        </div>
      </div>
      <div className="h-px w-full bg-border-light" />
      <div className="bg-surface-secondary/50 px-[16px] py-[8px]">
        <DayPicker selectedDays={days} onToggleDay={noop} disabled />
      </div>
    </div>
  );
}

// Avoidance-style names ("no screens", "quit", "less", "cut") read as Break; the
// rest as Build. A preview heuristic; the real polarity comes from capture.
function inferPolarity(name: string): HabitPolarity {
  return /\b(no|not|stop|quit|less|avoid|cut|reduce|off|after)\b/i.test(name) ? 'break' : 'build';
}

export type FullPlanBeatProps = {
  locale?: string;
  morningTime?: string;
  eveningTime?: string;
  buttonLabel?: string;
  buttonEditLabel?: string;
  coachLine?: string;
  onAdvance?: () => void;
  [key: string]: unknown;
};

export function FullPlanBeat(props?: FullPlanBeatProps) {
  const flow = useFlowState();
  const ritualDays = ritualWeekdaysForLocale(props?.locale);

  // Times: prefer real values lifted from the morning and evening beats, fall
  // back to props (custom preview), then a default so the static tile reads full.
  const morningTime = flow?.morningTime
    ? formatTime12(flow.morningTime)
    : (props?.morningTime ?? '8:00 AM');
  const eveningTime = flow?.eveningTime
    ? formatTime12(flow.eveningTime)
    : (props?.eveningTime ?? '9:30 PM');

  // Habits: real selections in Play, sample on the static canvas.
  const habitNames = flow && flow.habits.length > 0 ? flow.habits : SAMPLE_HABITS;
  const habitConfigs = flow?.habitConfigs ?? {};

  function habitDays(name: string): Set<number> {
    const cfg = habitConfigs[name];
    return cfg && cfg.days && cfg.days.length ? new Set(cfg.days) : ritualDays;
  }

  const plan = (
    <div className="flex w-full max-w-[360px] flex-col" style={{ gap: SPACE.sm }}>
      <span style={{ ...SECTION_LABEL, fontFamily: FONT, color: PRIMARY, marginBottom: SPACE.xs }}>
        Your plan
      </span>
      <PlanCard name="Morning check-in" days={ritualDays} time={morningTime} />
      {habitNames.map((h) => (
        <HabitScheduleCard
          key={h}
          habitName={h}
          polarity={inferPolarity(h)}
          selectedDays={habitDays(h)}
          onChangePolarity={noop}
          onToggleDay={noop}
          onEdit={noop}
          onDelete={noop}
        />
      ))}
      <PlanCard name="Evening habit report" days={ritualDays} time={eveningTime} />
      <PlanCard name="Evening reflection" days={ritualDays} time={eveningTime} />
    </div>
  );

  // L7: tap-path review buttons. Approve and start (primary) plus an edit button
  // that opens the voice-driven add / edit / delete flow. On the voice path these
  // are hidden and the user just says what they want.
  const reviewButtons = (
    <div
      style={{
        width: '100%',
        marginTop: SPACE.xs,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.xs,
      }}
    >
      <Button variant="primary" size="auth" fullWidth onClick={props?.onAdvance}>
        {props?.buttonLabel ?? 'Approve and start'}
      </Button>
      <Button variant="secondary" size="auth" fullWidth>
        {props?.buttonEditLabel ?? 'I want to change something'}
      </Button>
    </div>
  );

  const steps: BeatStep[] = [
    {
      id: 'coach-intro',
      speaker: 'coach',
      say:
        props?.coachLine ??
        "Here's your plan. Your check-in, your reflection, and the habits you picked. Want to start here, or change anything first?",
    },
    { id: 'plan-card', speaker: 'coach', render: plan },
    { id: 'approve', speaker: 'coach', render: reviewButtons },
  ];

  return <BeatPlayer steps={steps} />;
}

const fullPlanBeat: BeatDef = {
  type: 'into-app',
  group: 'Onboarding',
  label: 'Full plan confirm',
  Comp: FullPlanBeat,
};

export default fullPlanBeat;
