import type { Meta, StoryObj } from '@storybook/react-vite';
import { AnimationsCtx } from '../beatKit';
import stateCheckBeat from './stateCheck';

// Renders the state-check beat with animations off, so all four rows and their
// words show at once for a quick copy review.
const meta: Meta = { title: 'Onboarding/State check words' };
export default meta;

type Story = StoryObj;

export const AllWordsShown: Story = {
  render: () => (
    <AnimationsCtx.Provider value={false}>
      <div style={{ maxWidth: 380, margin: '0 auto' }}>
        <stateCheckBeat.Comp />
      </div>
    </AnimationsCtx.Provider>
  ),
};
