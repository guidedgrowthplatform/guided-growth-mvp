import { Icon } from '@iconify/react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface Template {
  id: string;
  title: string;
  description: string;
  categories: string[];
  quick?: boolean;
}

const TEMPLATES: Template[] = [
  {
    id: '5-minute-morning',
    title: '5-Minute Morning',
    description: 'Set a positive tone for the day with gratitude and intention.',
    categories: ['All', 'Morning'],
    quick: true,
  },
  {
    id: 'evening-wind-down',
    title: 'Evening Wind Down',
    description: 'Reflect on your achievements and let go of stress.',
    categories: ['All', 'Evening'],
  },
  {
    id: 'anxiety-relief',
    title: 'Anxiety Relief',
    description: 'Ground yourself and identify what is within your control.',
    categories: ['All', 'Anxiety'],
  },
  {
    id: 'daily-reflection',
    title: 'Daily Reflection',
    description: 'A deep dive into your emotional landscape and key learnings.',
    categories: ['All'],
  },
];

const CATEGORIES = ['All', 'Morning', 'Evening', 'Mindfulness', 'Anxiety'];

interface TemplateSelectProps {
  selected: string | null;
  onSelect: (id: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function TemplateSelect({ selected, onSelect, onContinue, onBack }: TemplateSelectProps) {
  const [category, setCategory] = useState('All');

  const filtered =
    category === 'All' ? TEMPLATES : TEMPLATES.filter((t) => t.categories.includes(category));

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

      {/* Filter pills */}
      <div className="mt-5 flex gap-3 overflow-x-auto pb-2" role="tablist">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={category === cat}
            onClick={() => setCategory(cat)}
            className={`shrink-0 rounded-full px-6 py-2.5 text-base font-medium transition-colors ${
              category === cat
                ? 'bg-primary text-white'
                : 'bg-surface-secondary text-content-secondary'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template cards */}
      <div className="mt-5 flex flex-col gap-4" role="radiogroup" aria-label="Template selection">
        {filtered.map((t) => (
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FEFCE8]">
                <Icon icon="mdi:checkbox-marked" width={20} height={20} className="text-primary" />
              </div>
              <span className="flex-1 text-base font-bold text-content">{t.title}</span>
              {t.quick && (
                <span className="rounded-full bg-[#FFF5F0] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-[#FFB59B]">
                  Quick
                </span>
              )}
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

      {/* AI suggestion banner */}
      <div className="mt-5 flex items-start gap-2 rounded-lg bg-[#EEF2FF] px-3 py-3">
        <Icon
          icon="ic:round-auto-awesome"
          width={20}
          height={20}
          className="mt-0.5 shrink-0 text-primary"
        />
        <span className="text-sm font-semibold text-primary">
          Need something unique? Our AI can craft a custom template based on your specific needs or
          goals.
        </span>
      </div>

      <div className="mt-auto pt-6">
        <Button variant="primary" size="auth" fullWidth disabled={!selected} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
