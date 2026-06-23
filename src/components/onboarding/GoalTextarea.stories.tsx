import type { Meta, StoryObj } from '@storybook/react-vite';
import { GoalTextarea } from './GoalTextarea';

const meta = {
  title: 'Onboarding/Goal Textarea',
  component: GoalTextarea,
  args: { value: 'I want a calmer morning routine.', onChange: () => {}, placeholder: 'Describe your goal' },
} satisfies Meta<typeof GoalTextarea>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { value: '' } };
