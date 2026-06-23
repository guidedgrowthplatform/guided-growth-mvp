import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import { RecentReflectionsSection } from './RecentReflectionsSection';

// note: this component reads React Query and navigation providers to render live.
const meta = {
  title: 'Home/Recent Reflections Section',
  component: RecentReflectionsSection,
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
} satisfies Meta<typeof RecentReflectionsSection>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
