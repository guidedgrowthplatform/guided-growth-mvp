import { useState } from 'react';
import { DailyReflectionCard } from '@/components/onboarding/DailyReflectionCard';
import { type ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

// Morning check-in setup: when the daily morning check happens + a reminder.
// First version reuses the schedule card; this gets the beat into the flow so
// the voice pipeline can attach.
function MorningCheckinSetupBeat(props?: Record<string, string>) {
  const [time, setTime] = useState('07:30');
  const [days, setDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
  const [reminder, setReminder] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleOption>('Every day');

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say: props?.coachLine ?? "When do you want your morning check-in? I'll nudge you then.",
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

const morningCheckinSetupBeat: BeatDef = {
  type: 'morning-checkin-setup',
  group: 'Onboarding',
  label: 'Morning check-in setup',
  Comp: MorningCheckinSetupBeat,
};

export default morningCheckinSetupBeat;
