import { useState } from 'react';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { Button } from '@/components/ui/Button';
import { goalsByCategory } from '@/data/onboardingHabits';
import { useOnboarding } from '@/hooks/useOnboarding';
import type { OnboardingCardApi } from './onboardingCardRegistry';

interface GoalsCardProps {
  data: { category?: string; goals?: string[] };
  api: OnboardingCardApi;
}

// Reads category from LIVE state so a late coach-captured category populates goals.
export function GoalsCard({ data, api }: GoalsCardProps) {
  const { state } = useOnboarding();
  const category = (state?.data?.category as string | undefined) ?? data.category;
  const goals = category ? (goalsByCategory[category] ?? []) : [];
  const [selected, setSelected] = useState<Set<string>>(() => {
    const allowed = new Set(goals);
    return new Set((data.goals ?? []).filter((g) => allowed.has(g)));
  });

  function toggle(goal: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(goal)) next.delete(goal);
      else if (next.size < 2) next.add(goal);
      return next;
    });
  }

  if (!category || goals.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        {goals.map((g) => (
          <GoalCard
            key={g}
            label={g}
            selected={selected.has(g)}
            disabled={!selected.has(g) && selected.size >= 2}
            onToggle={() => toggle(g)}
          />
        ))}
      </div>
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={() => selected.size > 0 && api.submitGoals?.([...selected])}
        disabled={selected.size === 0}
        loading={api.busy}
      >
        Continue
      </Button>
    </div>
  );
}
