import { useState } from 'react';
import { checkInDimensions } from '@/components/home/checkInConfig';
import { EmojiOptionButton } from '@/components/home/EmojiOptionButton';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

// The morning state-check card: all four rows (sleep, mood, energy, stress) in one
// card, the user taps each. This is the real four-row card, not the mood-only row.
function StateCheckCard() {
  const [sel, setSel] = useState<Record<string, number>>({});
  return (
    <div className="flex w-full max-w-[360px] flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
      {checkInDimensions.map((dim) => (
        <div key={dim.key} className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-content-subtle">{dim.label}</span>
          <div className="flex w-full justify-between">
            {dim.options.map((o) => (
              <EmojiOptionButton
                key={o.value}
                icon={o.icon}
                label={o.label}
                color={o.color}
                isSelected={sel[dim.key] === o.value}
                onClick={() => setSel((p) => ({ ...p, [dim.key]: o.value }))}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StateCheckBeat(props?: Record<string, string>) {
  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say:
        props?.coachLine ??
        'How are you landing this morning? Mood, energy, sleep, any stress. Tap each or just tell me.',
    },
    { id: 'card', speaker: 'coach', render: <StateCheckCard /> },
  ];
  return <BeatPlayer steps={steps} />;
}

const stateCheckBeat: BeatDef = {
  type: 'state-check',
  group: 'Check-in',
  label: 'State check (sleep / mood / energy / stress)',
  Comp: StateCheckBeat,
};

export default stateCheckBeat;
