import type { Meta, StoryObj } from '@storybook/react-vite';
import { UserInfoSection } from './UserInfoSection';

const meta = {
  title: 'Settings/User Info Section',
  component: UserInfoSection,
  args: { name: 'Yair Amsel', email: 'yair@example.com', nickname: 'Yair', avatarUrl: undefined, onEditProfile: () => {}, onChangePhoto: () => {} },
} satisfies Meta<typeof UserInfoSection>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
