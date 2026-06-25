import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';

function PlanCardsBeat(props?: Record<string, string>) {
  // The plan reflects the habits picked upstream, one card each, plus the daily
  // reflection. On the canvas it falls back to a sample habit.
  const flow = useFlowState();
  const habits = flow?.habits.length ? flow.habits : ['No screens after 10 PM'];

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say: props?.coachLine ?? "Here's your starting plan. We'll adjust as we go.",
    },
    {
      id: 'show',
      speaker: 'coach',
      render: (
        <div className="flex flex-col gap-3">
          {habits.map((h) => (
            <PlanSummaryCard
              key={h}
              icon="mdi:checkbox-marked-circle-outline"
              typeLabel="Habit"
              title={h}
              cadence="Every day"
              rule=""
              onEdit={() => {}}
            />
          ))}
          <PlanSummaryCard
            icon="mdi:notebook-outline"
            typeLabel="Journal"
            title="Daily Reflection"
            cadence="Every day"
            rule="3 questions"
            onEdit={() => {}}
          />
        </div>
      ),
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const planCardsBeat: BeatDef = {
  type: 'plan-cards',
  group: 'Onboarding',
  label: 'Plan summary',
  Comp: PlanCardsBeat,
};

export default planCardsBeat;
