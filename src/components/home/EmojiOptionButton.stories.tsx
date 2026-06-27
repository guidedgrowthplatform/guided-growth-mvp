import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { checkInDimensions } from './checkInConfig';
import { EmojiOptionButton } from './EmojiOptionButton';

const mood = checkInDimensions.find((d) => d.key === 'mood')!;

const meta = {
  title: 'Check-in/Emoji Option Button',
  component: EmojiOptionButton,
  args: {
    icon: () => null,
    label: 'Sample',
    color: '#000000',
    isSelected: false,
    onClick: () => {},
  },
} satisfies Meta<typeof EmojiOptionButton>;
export default meta;

type Story = StoryObj<typeof meta>;

// The full Mood row, the way it appears in the check-in card.
export const MoodRow: Story = {
  render: () => {
    const [selected, setSelected] = useState<number | null>(4);
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        {mood.options.map((o) => (
          <EmojiOptionButton
            key={o.value}
            icon={o.icon}
            label={o.label}
            color={o.color}
            isSelected={selected === o.value}
            onClick={() => setSelected(o.value)}
          />
        ))}
      </div>
    );
  },
};
