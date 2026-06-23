import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  EnergyCharged,
  MoodAwesome,
  MoodAwful,
  MoodMeh,
  SleepGood,
  StressZen,
} from './CheckInIcons';

// CheckInIcons exports a family of mood/sleep/energy/stress glyphs that take a color.
const meta = {
  title: 'Home/Check-In Icons',
  component: MoodAwesome,
  args: { color: 'rgb(19,91,235)' },
} satisfies Meta<typeof MoodAwesome>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Gallery: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, color: 'rgb(19,91,235)' }}>
      <MoodAwful color="rgb(239,68,68)" />
      <MoodMeh color="rgb(148,163,184)" />
      <MoodAwesome color="rgb(34,197,94)" />
      <SleepGood color="rgb(19,91,235)" />
      <EnergyCharged color="rgb(34,197,94)" />
      <StressZen color="rgb(124,58,237)" />
    </div>
  ),
};
