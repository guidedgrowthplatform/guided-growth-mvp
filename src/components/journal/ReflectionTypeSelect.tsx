import { Icon } from '@iconify/react';
import { SelectionCard } from '@/components/onboarding/SelectionCard';
import { Button } from '@/components/ui/Button';

type ReflectionType = 'ai' | 'template' | 'freeform';

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
  badge?: string;
  badgeVariant?: 'primary' | 'muted';
}[] = [
  {
    key: 'ai',
    icon: 'mdi:pencil-outline',
    iconBg: '#EEF2FF',
    title: 'AI Guided Reflection',
    description:
      "I'll ask you a few personalized questions to guide your thoughts and reflections.",
    badge: 'Recommended for consistency',
    badgeVariant: 'primary',
  },
  {
    key: 'template',
    icon: 'mdi:pencil-outline',
    iconBg: '#EEF2FF',
    title: 'Template Reflection',
    description: 'Structured prompts for specific themes (e.g., Gratitude, Future, Challenges).',
    badge: 'For a quick start',
    badgeVariant: 'muted',
  },
  {
    key: 'freeform',
    icon: 'mdi:pencil-outline',
    iconBg: '#EEF2FF',
    title: 'Freeform Reflection',
    description:
      'Write whatever is on your mind. A blank page for unrestricted expression and flow.',
    badge: 'For unrestricted flow',
    badgeVariant: 'muted',
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

      <div className="mt-6 flex items-center gap-2 rounded-lg bg-[#EEF2FF] px-3 py-3">
        <Icon
          icon="ic:round-auto-awesome"
          width={20}
          height={20}
          className="shrink-0 text-primary"
        />
        <span className="text-sm font-semibold text-primary">
          Let&apos;s make this reflection special. Tell me your preferred style!
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-4" role="radiogroup" aria-label="Reflection type">
        {types.map((t) => (
          <div key={t.key} className="relative">
            <SelectionCard
              icon={t.icon}
              iconBg={t.iconBg}
              title={t.title}
              description={t.description}
              selected={selected === t.key}
              onSelect={() => onSelect(t.key)}
            />
            {t.badge && (
              <span
                className={`absolute bottom-4 left-[21px] rounded-full px-3 py-1 text-xs font-bold ${
                  t.badgeVariant === 'primary'
                    ? 'bg-primary text-white'
                    : 'bg-surface-secondary text-content-secondary'
                }`}
              >
                {t.badge}
              </span>
            )}
          </div>
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
