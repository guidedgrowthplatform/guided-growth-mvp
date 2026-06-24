import { useState } from 'react';
import { DailyReflectionCard } from '@/components/onboarding/DailyReflectionCard';
import { type ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { type BeatDef } from '../beatKit';

function ReflectionCardBeat(_props?: Record<string, string>) {
  const [time, setTime] = useState('21:30');
  const [days, setDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
  const [reminder, setReminder] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleOption>('Every day');
  return (
    <DailyReflectionCard
      time={time}
      onTimeChange={setTime}
      days={days}
      onToggleDay={(d) =>
        setDays((p) => {
          const n = new Set(p);
          if (n.has(d)) n.delete(d);
          else n.add(d);
          return n;
        })
      }
      reminder={reminder}
      onToggleReminder={setReminder}
      schedule={schedule}
      onScheduleChange={setSchedule}
    />
  );
}

const reflectionCardBeat: BeatDef = {
  type: 'reflection-card',
  group: 'Onboarding',
  label: 'Daily reflection',
  Comp: ReflectionCardBeat,
};

export default reflectionCardBeat;
