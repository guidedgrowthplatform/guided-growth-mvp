import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

function PlanCardsBeat(props?: Record<string, string>) {
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
