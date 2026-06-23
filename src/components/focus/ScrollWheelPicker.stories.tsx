import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimePicker } from './ScrollWheelPicker';

const HOUR_VALUES = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_VALUES = Array.from({ length: 60 }, (_, i) => i);
const SECOND_VALUES = Array.from({ length: 60 }, (_, i) => i);

const meta = {
  title: 'Focus/Scroll Wheel Picker',
  component: TimePicker,
  args: {
    hours: 0,
    minutes: 25,
    seconds: 0,
    onChangeHours: () => {},
    onChangeMinutes: () => {},
    onChangeSeconds: () => {},
    hourValues: HOUR_VALUES,
    minuteValues: MINUTE_VALUES,
    secondValues: SECOND_VALUES,
  },
} satisfies Meta<typeof TimePicker>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FifteenMinutes: Story = {
  args: {
    hours: 0,
    minutes: 15,
    seconds: 0,
  },
};

export const OneHour: Story = {
  args: {
    hours: 1,
    minutes: 0,
    seconds: 0,
  },
};

export const WithSeconds: Story = {
  args: {
    hours: 0,
    minutes: 5,
    seconds: 30,
  },
};
