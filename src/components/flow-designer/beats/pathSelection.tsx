import { useState } from 'react';
import { SelectionCard } from '@/components/onboarding/SelectionCard';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

function PathSelectionBeat(props?: Record<string, string>) {
  const [sel, setSel] = useState('new');

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say: props?.coachLine ?? 'Have you tracked habits before, or is this new for you?',
    },
    {
      id: 'show',
      speaker: 'coach',
      render: (
        <div className="flex flex-col gap-3">
          <SelectionCard
            icon="mdi:sparkles"
            title="I'm new to habit tracking"
            description="I'll help you step by step"
            selected={sel === 'new'}
            onSelect={() => setSel('new')}
          />
          <SelectionCard
            icon="mdi:lightning-bolt"
            title="I already track habits"
            description="Tell me your habits and I'll organize them"
            selected={sel === 'exp'}
            onSelect={() => setSel('exp')}
          />
        </div>
      ),
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const pathSelectionBeat: BeatDef = {
  type: 'path-selection',
  group: 'Onboarding',
  label: 'Path choice',
  Comp: PathSelectionBeat,
};

export default pathSelectionBeat;
