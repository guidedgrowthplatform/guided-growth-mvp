import { useState } from 'react';
import { DailyReflectionCard } from '@/components/onboarding/DailyReflectionCard';
import { type ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

function ReflectionCardBeat(props?: Record<string, string>) {
  const [time, setTime] = useState('21:30');
  const [days, setDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
  const [reminder, setReminder] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleOption>('Every day');

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say: props?.coachLine ?? "Let's set a daily moment to reflect. When works for you?",
    },
    {
      id: 'show',
      speaker: 'coach',
      render: (
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
      ),
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const reflectionCardBeat: BeatDef = {
  type: 'reflection-card',
  group: 'Onboarding',
  label: 'Daily reflection',
  Comp: ReflectionCardBeat,
};

export default reflectionCardBeat;
