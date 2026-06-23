import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import { AuthBackButton } from './AuthBackButton';

const meta = {
  title: 'Auth/AuthBackButton',
  component: AuthBackButton,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof AuthBackButton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnDarkBackground: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="flex items-center justify-center bg-neutral-900 p-8 rounded-xl">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
};
