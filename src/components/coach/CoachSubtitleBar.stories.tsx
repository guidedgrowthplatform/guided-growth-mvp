import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';
import { CoachSubtitleBar } from './CoachSubtitleBar';

const meta = {
  title: 'Coach/Coach Subtitle Bar',
  component: CoachSubtitleBar,
} satisfies Meta<typeof CoachSubtitleBar>;
export default meta;

type Story = StoryObj<typeof meta>;

// NOTE: CoachSubtitleBar reads from CoachVoiceSession context and the
// voiceStore Zustand store at render time. Without those providers it returns
// null (no latestText). The Default story below renders the component directly;
// it will be blank in Storybook unless the required providers are added to
// .storybook/preview.tsx. The visual stories below use inline mock UI so you
// can review the three display states without providers.

export const Default: Story = {};

// ---------------------------------------------------------------------------
// Visual mock stories — render the three display states directly so the bar
// is always visible regardless of provider setup.
// ---------------------------------------------------------------------------

const BAR_HEIGHT = 88;
const BAR_BOTTOM = 240;
const SAMPLE_TEXT =
  "I've been feeling a bit off lately, like there's something I can't quite put my finger on.";

export const Expanded: Story = {
  render: () => {
    const [state, setState] = useState<'expanded' | 'collapsed' | 'closed'>('expanded');

    if (state === 'collapsed') {
      return (
        <button
          type="button"
          onClick={() => setState('expanded')}
          aria-label="Show coach subtitle"
          style={{ bottom: BAR_BOTTOM, height: BAR_HEIGHT }}
          className="fixed left-0 z-30 flex w-7 items-center justify-center rounded-r-2xl bg-surface-secondary text-content shadow-[0_8px_24px_-8px_rgba(15,23,42,0.4)]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      );
    }

    if (state === 'closed') {
      return (
        <div className="fixed inset-x-4 z-30 flex items-center justify-center" style={{ bottom: BAR_BOTTOM }}>
          <p className="text-sm text-gray-400 italic">(subtitle dismissed)</p>
        </div>
      );
    }

    return (
      <div
        role="status"
        aria-live="polite"
        style={{ bottom: BAR_BOTTOM, height: BAR_HEIGHT }}
        className="fixed inset-x-4 z-30 flex items-center gap-2 rounded-2xl bg-surface-secondary px-3 pr-8 text-content shadow-[0_8px_24px_-8px_rgba(15,23,42,0.4)]"
      >
        <button
          type="button"
          onClick={() => setState('collapsed')}
          aria-label="Collapse subtitle"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="line-clamp-2 flex-1 text-[15px] font-semibold leading-[20px]">{SAMPLE_TEXT}</p>
        <button
          type="button"
          onClick={() => setState('closed')}
          aria-label="Dismiss subtitle"
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  },
};

export const Collapsed: Story = {
  render: () => (
    <button
      type="button"
      aria-label="Show coach subtitle"
      style={{ bottom: BAR_BOTTOM, height: BAR_HEIGHT }}
      className="fixed left-0 z-30 flex w-7 items-center justify-center rounded-r-2xl bg-surface-secondary text-content shadow-[0_8px_24px_-8px_rgba(15,23,42,0.4)]"
    >
      <ChevronRight className="h-4 w-4" />
    </button>
  ),
};

export const LongText: Story = {
  render: () => (
    <div
      role="status"
      aria-live="polite"
      style={{ bottom: BAR_BOTTOM, height: BAR_HEIGHT }}
      className="fixed inset-x-4 z-30 flex items-center gap-2 rounded-2xl bg-surface-secondary px-3 pr-8 text-content shadow-[0_8px_24px_-8px_rgba(15,23,42,0.4)]"
    >
      <button
        type="button"
        aria-label="Collapse subtitle"
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <p className="line-clamp-2 flex-1 text-[15px] font-semibold leading-[20px]">
        That is a really important insight — it sounds like you have been carrying this for a while
        and it is starting to affect how you show up each day. Let us explore that a bit more.
      </p>
      <button
        type="button"
        aria-label="Dismiss subtitle"
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  ),
};
