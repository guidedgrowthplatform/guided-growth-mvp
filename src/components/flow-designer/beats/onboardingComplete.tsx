import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DayPicker } from '@/components/ui/DayPicker';
import { formatTime12 } from '@/components/ui/TimePicker';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';
import { FONT, PRIMARY, SECTION_LABEL, SPACE } from './_beatStyle';

// The one full-plan confirm. Redesigned 2026-06-29: every item in the plan shows
// as the same card the schedule uses (HabitScheduleCard shape): the name, a time
// chip, and the read-only day circles. The three daily rituals (morning check-in,
// evening check-in, evening reflection) are pinned to every day with their times;
// the user habits show the days and time they picked. Approve drops into the app.

const SAMPLE_HABITS = ['Morning walk', 'No screens after 10 PM'];
const EVERY_DAY: Set<number> = new Set([0, 1, 2, 3, 4, 5, 6]);
const noop = () => undefined;

// One plan row in the same card shape as HabitScheduleCard: name on the left, a
// time chip on the right, and the read-only day circles below.
function PlanCard({ name, days, time }: { name: string; days: Set<number>; time?: string }) {
  return (
    <div className="w-full overflow-clip rounded-[20px] border-2 border-primary bg-surface p-[2px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)]">
      <div className="px-[16px] pb-[10px] pt-[12px]">
        <div className="flex items-center justify-between gap-[8px]">
          <span className="min-w-0 flex-1 text-[15px] font-bold leading-[20px] text-content">
            {name}
          </span>
          {time && (
            <span className="flex shrink-0 items-center gap-[4px] rounded-full border border-primary/30 bg-primary/10 px-[8px] py-[3px] text-[11px] font-semibold text-primary">
              <Clock className="size-[12px]" />
              {time}
            </span>
          )}
        </div>
      </div>
      <div className="h-px w-full bg-border-light" />
      <div className="bg-surface-secondary/50 px-[16px] py-[8px]">
        <DayPicker selectedDays={days} onToggleDay={noop} disabled />
      </div>
    </div>
  );
}

function FullPlanBeat(props?: Record<string, string>) {
  const flow = useFlowState();

  // Times: prefer real values lifted from the morning and evening beats, fall
  // back to props (custom preview), then a default so the static tile reads full.
  const morningTime = flow?.morningTime ? formatTime12(flow.morningTime) : (props?.morningTime ?? '8:00 AM');
  const eveningTime = flow?.eveningTime ? formatTime12(flow.eveningTime) : (props?.eveningTime ?? '9:30 PM');

  // Habits: real selections in Play, sample on the static canvas.
  const habitNames = flow && flow.habits.length > 0 ? flow.habits : SAMPLE_HABITS;
  const habitConfigs = flow?.habitConfigs ?? {};

  function habitDays(name: string): Set<number> {
    const cfg = habitConfigs[name];
    return cfg && cfg.days && cfg.days.length ? new Set(cfg.days) : EVERY_DAY;
  }
  function habitTime(name: string): string | undefined {
    const cfg = habitConfigs[name];
    return cfg?.time ? formatTime12(cfg.time) : undefined;
  }

  const plan = (
    <div className="flex w-full max-w-[360px] flex-col" style={{ gap: SPACE.sm }}>
      <span style={{ ...SECTION_LABEL, fontFamily: FONT, color: PRIMARY, marginBottom: SPACE.xs }}>
        Your plan
      </span>
      <PlanCard name="Morning check-in" days={EVERY_DAY} time={morningTime} />
      {habitNames.map((h) => (
        <PlanCard key={h} name={h} days={habitDays(h)} time={habitTime(h)} />
      ))}
      <PlanCard name="Evening check-in" days={EVERY_DAY} time={eveningTime} />
      <PlanCard name="Evening reflection" days={EVERY_DAY} time={eveningTime} />
    </div>
  );

  const approveButton = (
    <div style={{ width: '100%', marginTop: SPACE.xs }}>
      <Button variant="primary" size="auth" fullWidth>
        {props?.buttonLabel ?? 'Approve and start'}
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
    { id: 'approve', speaker: 'coach', render: approveButton },
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
