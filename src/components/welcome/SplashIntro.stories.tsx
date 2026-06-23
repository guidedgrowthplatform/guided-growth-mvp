import type { Meta, StoryObj } from '@storybook/react-vite';
import { SplashIntro } from './SplashIntro';

const meta = {
  title: 'Welcome/Splash Intro',
  component: SplashIntro,
  args: { onComplete: () => {}, loop: false, autoPlay: false, audioSrc: undefined },
} satisfies Meta<typeof SplashIntro>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Looping: Story = { args: { loop: true, autoPlay: true } };
