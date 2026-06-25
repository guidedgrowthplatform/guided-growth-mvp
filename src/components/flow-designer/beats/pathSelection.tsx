import { useState } from 'react';
import { Icon } from '@iconify/react';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

const FONT = 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const BLUE = 'rgb(19, 91, 235)';

// One path choice. The whole card lights up when picked (blue border + tint + a
// blue icon tile + a check), so the choice is never ambiguous. Icon sits in a
// real tinted tile instead of floating.
function ChoiceCard({
  icon,
  title,
  sub,
  selected,
  onSelect,
}: {
  icon: string;
  title: string;
  sub: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        textAlign: 'left',
        padding: '16px 18px',
        borderRadius: 20,
        cursor: 'pointer',
        background: selected ? 'rgba(19,91,235,0.06)' : '#fff',
        border: selected ? `2px solid ${BLUE}` : '2px solid rgba(15,23,42,0.06)',
        boxShadow: selected
          ? '0 10px 26px -12px rgba(19,91,235,0.40)'
          : '0 4px 16px -8px rgba(15,23,42,0.12)',
        transition: 'background 160ms ease-out, border-color 160ms ease-out, box-shadow 160ms ease-out',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: selected ? BLUE : 'rgba(19,91,235,0.10)',
          transition: 'background 160ms ease-out',
        }}
      >
        <Icon icon={icon} width={26} height={26} style={{ color: selected ? '#fff' : BLUE }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT, fontSize: 17, fontWeight: 700, color: 'rgb(15,23,42)', lineHeight: 1.2 }}>
          {title}
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 13.5,
            fontWeight: 500,
            color: 'rgb(100,116,139)',
            marginTop: 3,
            lineHeight: 1.35,
          }}
        >
          {sub}
        </div>
      </div>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: selected ? 'none' : '2px solid rgb(203,213,225)',
          background: selected ? BLUE : 'transparent',
        }}
      >
        {selected && <Icon icon="mdi:check" width={15} height={15} style={{ color: '#fff' }} />}
      </div>
    </button>
  );
}

function PathSelectionBeat(props?: Record<string, string>) {
  const [sel, setSel] = useState<'new' | 'exp'>('new');

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ChoiceCard
            icon="mdi:sprout-outline"
            title={props?.newTitle ?? "I'm new to this"}
            sub={props?.newSub ?? "We'll start fresh and build your first habits together."}
            selected={sel === 'new'}
            onSelect={() => setSel('new')}
          />
          <ChoiceCard
            icon="mdi:format-list-checks"
            title={props?.expTitle ?? 'I already track habits'}
            sub={props?.expSub ?? "Read me your list and we'll get it organized."}
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
