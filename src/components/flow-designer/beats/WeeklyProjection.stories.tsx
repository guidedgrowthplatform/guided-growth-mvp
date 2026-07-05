import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentType } from 'react';
import weeklyProjectionBeat, { type ProjectionState } from './weeklyProjection';

// Renders the real weekly projection beat (which uses the rebuilt
// WeeklyHabitsSummary, split into WeeklyHabitsHeader + WeeklyHabitRow) in all
// five states, so the stacked layout, the today column, the flames, and the
// legend can be eyeballed against the approved mock.
const Comp = weeklyProjectionBeat.Comp as ComponentType<{ state?: ProjectionState }>;

const STATES: { state: ProjectionState; tag: string }[] = [
  { state: 'blank', tag: '1. Fresh start' },
  { state: 'full', tag: '2. All green' },
  { state: 'p78', tag: '3. Good week' },
  { state: 'p36', tag: '4. Mostly missed' },
  { state: 'gaps', tag: '5. What to avoid' },
];

const meta: Meta = {
  title: 'Onboarding/Weekly projection',
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj;

export const AllStates: Story = {
  render: () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 28,
        padding: 24,
        background: '#E9EDF3',
      }}
    >
      {STATES.map(({ state, tag }) => (
        <div key={state} style={{ width: 360 }}>
          <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>{tag}</p>
          <div
            style={{
              background: '#F5F7FB',
              border: '10px solid #1A1D29',
              borderRadius: 40,
              padding: '16px 12px',
            }}
          >
            <Comp state={state} />
          </div>
        </div>
      ))}
    </div>
  ),
};
