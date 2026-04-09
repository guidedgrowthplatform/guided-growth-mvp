import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/Button';

interface Template {
  id: string;
  title: string;
  description: string;
  icon: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'proud',
    title: 'Proud',
    description: 'Reflect on what you accomplished today and celebrate your wins.',
    icon: 'mdi:trophy-outline',
  },
  {
    id: 'forgive',
    title: 'Forgive',
    description: "Let go of something that didn't go as planned. Growth starts with grace.",
    icon: 'mdi:hand-heart-outline',
  },
  {
    id: 'grateful',
    title: 'Grateful',
    description: 'Appreciate the people, moments, and things that made today meaningful.',
    icon: 'mdi:heart-outline',
  },
  {
    id: 'custom',
    title: 'Create Your Own Template',
    description: 'Write your own prompts and structure your reflection your way.',
    icon: 'mdi:pencil-outline',
  },
];

interface TemplateSelectProps {
  selected: string | null;
  onSelect: (id: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function TemplateSelect({ selected, onSelect, onContinue, onBack }: TemplateSelectProps) {
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

      <h1 className="text-[30px] font-bold leading-tight text-content">Guided Reflection</h1>
      <p className="mt-3 text-base text-content-secondary">
        Choose a structure for your thoughts today.
      </p>

      {/* Template cards */}
      <div className="mt-6 flex flex-col gap-4" role="radiogroup" aria-label="Template selection">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={selected === t.id}
            onClick={() => onSelect(t.id)}
            className={`w-full rounded-2xl border bg-surface p-5 text-left shadow-card transition-all ${
              selected === t.id ? 'border-primary' : 'border-border-light'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon icon={t.icon} width={20} height={20} className="text-primary" />
              </div>
              <span className="flex-1 text-base font-bold text-content">{t.title}</span>
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-content-tertiary">
                {selected === t.id && <div className="h-3 w-3 rounded-full bg-primary" />}
              </div>
            </div>
            <div className="mt-4 rounded-md bg-surface-secondary p-4 text-sm font-medium text-content-secondary">
              {t.description}
            </div>
          </button>
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
