import type { Meta, StoryObj } from '@storybook/react-vite';
import { type ReactNode } from 'react';
import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { DualButton } from './DualButton';

// The orb is a two-half dial: left half = coach (AI output), right half = user (mic).
// An active half is blue (bg-primary); an inactive half is gray (bg-slate-400).
// This story is the single place to see every orb state and every ring animation.

const meta = {
  title: 'UI/Dual Button (Orb)',
  component: DualButton,
  parameters: { layout: 'centered' },
  // Defaults so render-only stories don't have to restate the required icon props.
  args: {
    leftIcon: <IconChatVoice size={28} />,
    rightIcon: <IconMic size={26} />,
  },
} satisfies Meta<typeof DualButton>;
export default meta;

type Story = StoryObj<typeof meta>;

type Rings = 'left' | 'right' | 'both' | 'idle' | 'ready' | null;

// Faithful orb: mirrors the icon mapping in OrbControls so the stories match the product.
function Orb({
  voiceOn,
  micOn,
  size = 150,
  activeRings,
  ringStep,
  ringCount = 3,
}: {
  voiceOn: boolean;
  micOn: boolean;
  size?: number;
  activeRings?: Rings;
  ringStep?: number;
  ringCount?: number;
}) {
  return (
    <DualButton
      size={size}
      leftActive={voiceOn}
      rightActive={micOn}
      activeRings={activeRings}
      ringStep={ringStep}
      ringCount={ringCount}
      intensity={activeRings === 'right' ? 0.8 : undefined}
      leftIcon={voiceOn ? <IconChatVoice size={28} /> : <IconChatText size={28} />}
      rightIcon={micOn ? <IconMic size={26} /> : <IconMicMuted size={26} />}
      leftAriaLabel="coach orb"
      rightAriaLabel="user orb"
    />
  );
}

function Cell({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {children}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', textAlign: 'center', lineHeight: 1.4 }}>
        {label}
      </div>
    </div>
  );
}

// The headline: all four orb states at once (matches OrbState in lib/orb/orbState.ts).
export const AllStates: Story = {
  name: 'All states (gallery)',
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div
      style={{
        fontFamily: 'Urbanist, sans-serif',
        background: '#f9f9f9',
        padding: 40,
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 48,
        placeItems: 'center',
      }}
    >
      <Cell label={'vapi — both blue\ncoach voice + mic live'}>
        <Orb voiceOn micOn size={120} />
      </Cell>
      <Cell label={'voice out only — left blue\ncoach speaks, mic off'}>
        <Orb voiceOn micOn={false} size={120} />
      </Cell>
      <Cell label={'voice in only — right blue\nmic on, coach on screen'}>
        <Orb voiceOn={false} micOn size={120} />
      </Cell>
      <Cell label={'text only — both gray\nno voice either way'}>
        <Orb voiceOn={false} micOn={false} size={120} />
      </Cell>
    </div>
  ),
};

// The exact thing asked for: both halves blue with the correct icons inside.
export const BothBlueWithIcons: Story = {
  name: 'Two halves, blue, with icons',
  render: () => <Orb voiceOn micOn />,
};

export const VapiBothBlue: Story = {
  name: 'State · vapi (both blue)',
  render: () => <Orb voiceOn micOn />,
};

export const VoiceOutOnly: Story = {
  name: 'State · voice out only (left blue)',
  render: () => <Orb voiceOn micOn={false} />,
};

export const VoiceInOnly: Story = {
  name: 'State · voice in only (right blue)',
  render: () => <Orb voiceOn={false} micOn />,
};

export const TextOnly: Story = {
  name: 'State · text only (both gray)',
  render: () => <Orb voiceOn={false} micOn={false} />,
};

// Ring animations (the part needed for the splash/idle animation).
export const AnimationIdle: Story = {
  name: 'Animation · idle (gold + blue pulse)',
  render: () => <Orb voiceOn micOn activeRings="idle" ringStep={14} />,
};

export const AnimationReady: Story = {
  name: 'Animation · ready (steady right arc)',
  render: () => <Orb voiceOn micOn activeRings="ready" ringStep={14} />,
};

export const AnimationCoachSpeaking: Story = {
  name: 'Animation · coach speaking (left ripple)',
  render: () => <Orb voiceOn micOn activeRings="left" ringStep={14} />,
};

export const AnimationUserSpeaking: Story = {
  name: 'Animation · user speaking (right ripple)',
  render: () => <Orb voiceOn micOn activeRings="right" ringStep={14} />,
};

export const AnimationBothSpeaking: Story = {
  name: 'Animation · both ripple',
  render: () => <Orb voiceOn micOn activeRings="both" ringStep={14} />,
};

export const StaticRings: Story = {
  name: 'Static concentric rings',
  render: () => (
    <DualButton
      size={150}
      leftActive
      rightActive
      rings
      leftIcon={<IconChatVoice size={28} />}
      rightIcon={<IconMic size={26} />}
    />
  ),
};
