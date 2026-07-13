import { Icon } from '@iconify/react';
import { useState } from 'react';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { FONT, PRIMARY as BLUE, INK, SUBTLE, SPACE } from './_beatStyle';

// The create-your-own screen, reached from "Create your own goal" (goals beat)
// or "Create your own habit" (habit beat). A very simple screen built from the
// components we already have: one titled text field and a save button. `kind`
// switches the copy between goal and habit.

type CustomEntryCardProps = {
  kind?: 'goal' | 'habit';
  hideOrb?: boolean;
  onAdvance?: () => void;
};

export function CustomEntryCard({ kind = 'goal', onAdvance }: CustomEntryCardProps) {
  const [value, setValue] = useState('');
  const label = kind === 'goal' ? 'Your goal' : 'Your habit';
  const placeholder =
    kind === 'goal' ? 'For example, sleep more consistently' : 'For example, walk after lunch';
  const trimmed = value.trim();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.md,
        width: '100%',
        maxWidth: 360,
      }}
    >
      <span
        style={{
          fontFamily: FONT,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: SUBTLE,
        }}
      >
        {label}
      </span>

      <div
        className="flex items-center gap-2 rounded-[24px] border bg-surface px-[16px] py-[12px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)]"
        style={{ borderColor: BLUE }}
      >
        <Icon
          icon="mdi:pencil-outline"
          width={18}
          height={18}
          style={{ color: BLUE, flexShrink: 0 }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-[16px] font-bold leading-[24px] text-content outline-none placeholder:font-normal placeholder:text-content-secondary/50"
          style={{ fontFamily: FONT, background: 'transparent', color: INK, border: 'none' }}
        />
      </div>

      <button
        type="button"
        disabled={!trimmed}
        onClick={onAdvance}
        style={{
          fontFamily: FONT,
          fontSize: 15,
          fontWeight: 700,
          color: trimmed ? '#fff' : 'rgba(15,23,42,0.35)',
          background: trimmed ? BLUE : 'rgba(15,23,42,0.07)',
          border: 'none',
          borderRadius: 16,
          padding: '13px 20px',
          cursor: trimmed ? 'pointer' : 'default',
          transition: 'background 180ms ease-out, color 180ms ease-out',
          textAlign: 'center',
        }}
      >
        {trimmed ? `Add ${kind}` : `Type your ${kind}`}
      </button>
    </div>
  );
}

function CustomEntryBeat(props?: Record<string, string>) {
  const kind: 'goal' | 'habit' = props?.kind === 'habit' ? 'habit' : 'goal';
  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say:
        props?.coachLine ??
        (kind === 'goal'
          ? "Tell me the goal you want to add, and I'll set it up."
          : "Tell me the habit you want to add, and I'll set it up."),
    },
    { id: 'entry', speaker: 'coach', render: <CustomEntryCard kind={kind} /> },
  ];
  return <BeatPlayer steps={steps} />;
}

const customEntryBeat: BeatDef = {
  type: 'custom-entry',
  group: 'Onboarding',
  label: 'Create your own (goal / habit)',
  Comp: CustomEntryBeat,
};

export default customEntryBeat;
