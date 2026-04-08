import { Icon } from '@iconify/react';
import { SelectionCard } from '@/components/onboarding/SelectionCard';
import { Button } from '@/components/ui/Button';

type ReflectionType = 'template' | 'freeform';

interface ReflectionTypeSelectProps {
  selected: ReflectionType | null;
  onSelect: (type: ReflectionType) => void;
  onContinue: () => void;
  onBack: () => void;
  userName: string;
}

const types: {
  key: ReflectionType;
  icon: string;
  iconBg: string;
  title: string;
  description: string;
  badge: string;
}[] = [
  {
    key: 'template',
    icon: 'mdi:pencil-outline',
    iconBg: '#EEF2FF',
    title: 'Template Reflection',
    description: 'Structured prompts for specific themes (e.g., Gratitude, Future, Challenges).',
    badge: 'For a quick start',
  },
  {
    key: 'freeform',
    icon: 'mdi:pencil-outline',
    iconBg: '#EEF2FF',
    title: 'Freeform Reflection',
    description:
      'Write whatever is on your mind. A blank page for unrestricted expression and flow.',
    badge: 'For unrestricted flow',
  },
];

export function ReflectionTypeSelect({
  selected,
  onSelect,
  onContinue,
  onBack,
  userName,
}: ReflectionTypeSelectProps) {
  return (
    <div className="flex min-h-screen flex-col px-6 pb-8 pt-4">
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back"
        className="mb-8 self-start text-content"
      >
        <Icon icon="mdi:arrow-left" width={24} height={24} />
      </button>

      <h1 className="text-[30px] font-bold leading-tight text-content">
        Hey {userName}, how would you like to reflect today?
      </h1>
      <p className="mt-3 text-base text-content-secondary">
        Choose a style that matches your current energy and focus.
      </p>

      <div className="mt-6 flex flex-col gap-4" role="radiogroup" aria-label="Reflection type">
        {types.map((t) => (
          <SelectionCard
            key={t.key}
            icon={t.icon}
            iconBg={t.iconBg}
            title={t.title}
            description={t.description}
            badge={t.badge}
            selected={selected === t.key}
            onSelect={() => onSelect(t.key)}
          />
        ))}
      </div>

      <div className="mt-auto pt-6">
        <Button variant="primary" size="auth" fullWidth disabled={!selected} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
