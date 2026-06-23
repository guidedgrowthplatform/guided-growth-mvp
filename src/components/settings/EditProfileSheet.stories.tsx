import type { Meta, StoryObj } from '@storybook/react-vite';
import { EditProfileSheet } from './EditProfileSheet';

// note: this component reads auth/profile update providers to render live.
const meta = {
  title: 'Settings/Edit Profile Sheet',
  component: EditProfileSheet,
  args: { onClose: () => {}, initialName: 'Yair Amsel', initialNickname: 'Yair', initialAvatarUrl: null },
} satisfies Meta<typeof EditProfileSheet>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
