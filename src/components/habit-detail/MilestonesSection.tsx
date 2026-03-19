import { MilestoneBadge } from './MilestoneBadge';

interface MilestonesSectionProps {
  milestones: { target: number; earned: boolean }[];
}

export function MilestonesSection({ milestones }: MilestonesSectionProps) {
  const earnedCount = milestones.filter((m) => m.earned).length;

  return (
    <div>
      <h2 className="text-xl font-bold text-content">Milestones</h2>
      <div className="mt-4 flex gap-6 overflow-x-auto pb-2">
        {milestones.map((m) => (
          <MilestoneBadge key={m.target} target={m.target} earned={m.earned} />
        ))}
      </div>
      <p className="mt-2 text-sm font-medium text-[#64748b]">{earnedCount} Milestones Earned</p>
    </div>
  );
}
