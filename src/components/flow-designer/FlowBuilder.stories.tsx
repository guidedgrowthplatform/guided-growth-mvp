import type { Meta, StoryObj } from '@storybook/react-vite';
import { FlowBuilder } from './FlowBuilder';

const meta = {
  title: 'Flow Designer/Flow Builder',
  component: FlowBuilder,
} satisfies Meta<typeof FlowBuilder>;
export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The full flow-builder canvas: component palette on the left, sortable
 * flow in the middle, and a live phone preview on the right.
 *
 * Notes:
 * - The component reads `localStorage` (key `gg-flow-builder-v4`) on mount
 *   and falls back to a hard-coded DEFAULT_FLOW when the key is absent.
 * - It also fires a `fetch` to `https://guidedgrowthos.com/internal/flow/beats`
 *   to load sheet-beat suggestions; the sidecar metadata panel works fine when
 *   the request fails (the select just shows no options).
 * - No React context or router is required, so the story renders standalone
 *   without any provider wrapper.
 */
export const Default: Story = {};

/**
 * Opens with a clean slate so reviewers see the empty-state messaging and
 * the drag-to-add UX hint without any pre-seeded components.
 *
 * Achieved by clearing the localStorage key before the story mounts.
 */
export const EmptyFlow: Story = {
  decorators: [
    (Story) => {
      localStorage.removeItem('gg-flow-builder-v4');
      return <Story />;
    },
  ],
};

/**
 * Seeds a minimal two-beat flow (coach bubble + primary button) so reviewers
 * can see what a short, filled flow looks like without scrolling through the
 * full DEFAULT_FLOW.
 */
export const ShortFlow: Story = {
  decorators: [
    (Story) => {
      localStorage.setItem(
        'gg-flow-builder-v4',
        JSON.stringify([
          { type: 'coach-bubble' },
          { type: 'primary-button' },
        ]),
      );
      return <Story />;
    },
  ],
};
