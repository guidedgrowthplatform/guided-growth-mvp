import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { categories, categoryImage } from '@/lib/onboarding/categoryTiles';
import type { OnboardingCardApi } from './onboardingCardRegistry';

interface CategoryPickerCardProps {
  data: { category?: string; gender?: string };
  api: OnboardingCardApi;
}

export function CategoryPickerCard({ data, api }: CategoryPickerCardProps) {
  const selected = data.category ?? null;

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {categories.map((c, i) => (
          <CategoryCard
            key={c.label}
            image={categoryImage(c, i, data.gender)}
            label={c.label}
            selected={selected === c.label}
            onSelect={() => api.submitCategory?.(c.label)}
          />
        ))}
      </div>
    </div>
  );
}
