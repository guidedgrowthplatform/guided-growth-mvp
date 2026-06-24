import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import { type BeatDef } from '../beatKit';

function PlanCardsBeat(_props?: Record<string, string>) {
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

const planCardsBeat: BeatDef = {
  type: 'plan-cards',
  group: 'Onboarding',
  label: 'Plan summary',
  Comp: PlanCardsBeat,
};

export default planCardsBeat;
