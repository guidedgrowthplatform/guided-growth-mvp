import type { Meta, StoryObj } from '@storybook/react-vite';
import { Component, type ReactNode } from 'react';
import profileBeat from './beats/profile';
import stateCheckBeat from './beats/stateCheck';
import morningBeat from './beats/morningCheckinSetup';
import categoryBeat from './beats/categoryGrid';
import goalsBeat from './beats/goalsList';
import habitPickerBeat from './beats/habitPicker';
import habitScheduleBeat from './beats/habitSchedule';
import reflectionBeat from './beats/reflectionCard';
import pathBeat from './beats/pathSelection';
import advFreqBeat from './beats/advancedFrequency';

const meta: Meta = { title: 'Onboarding/All components', parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;

// One failing beat should not blank the whole page.
class Boundary extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() {
    return { err: true };
  }
  render() {
    return this.state.err ? (
      <div style={{ fontSize: 12, color: '#b91c1c', padding: 12 }}>could not render standalone</div>
    ) : (
      this.props.children
    );
  }
}

const BEATS = [
  profileBeat,
  stateCheckBeat,
  morningBeat,
  categoryBeat,
  goalsBeat,
  habitPickerBeat,
  habitScheduleBeat,
  reflectionBeat,
  pathBeat,
  advFreqBeat,
];

// All the real onboarding beat components on one page, for a final visual pass.
export const AllComponents: Story = {
  render: () => (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 28,
        padding: 24,
        background: '#E9EDF3',
        alignItems: 'flex-start',
      }}
    >
      {BEATS.map((b, i) => (
        <div key={b.type} style={{ width: 372 }}>
          <div style={{ fontFamily: 'system-ui', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            {i + 1}. {b.label}
          </div>
          <div
            style={{
              background: '#F5F7FB',
              border: '1px solid #E2E8F0',
              borderRadius: 22,
              padding: 16,
              minHeight: 180,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Boundary>
              <b.Comp />
            </Boundary>
          </div>
        </div>
      ))}
    </div>
  ),
};
