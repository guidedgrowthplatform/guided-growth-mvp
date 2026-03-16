import { Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { InfoBox } from '@/components/ui/InfoBox';
import { TimePicker } from '@/components/ui/TimePicker';
import { Toggle } from '@/components/ui/Toggle';

interface ReminderSheetProps {
  onClose: () => void;
}

interface ReminderCardProps {
  emoji: string;
  iconBg: string;
  label: string;
  time: string;
  onTimeChange: (time24: string) => void;
  reminderEnabled: boolean;
  onToggle: (v: boolean) => void;
}

function ReminderCard({
  emoji,
  iconBg,
  label,
  time,
  onTimeChange,
  reminderEnabled,
  onToggle,
}: ReminderCardProps) {
  return (
    <div className="flex flex-col gap-2 border border-gray-100 p-[17px] shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${iconBg}`}>
            <span className="text-lg">{emoji}</span>
          </div>
          <span className="text-base font-bold text-content">{label}</span>
        </div>
        <TimePicker value={time} onChange={onTimeChange} />
      </div>
      <div className="flex items-center justify-between py-2">
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Reminder
        </span>
        <Toggle checked={reminderEnabled} onChange={onToggle} />
      </div>
    </div>
  );
}

export function ReminderSheet({ onClose }: ReminderSheetProps) {
  const [morningTime, setMorningTime] = useState('07:15');
  const [nightTime, setNightTime] = useState('21:50');
  const [morningReminder, setMorningReminder] = useState(true);
  const [nightReminder, setNightReminder] = useState(true);

  return (
    <BottomSheet onClose={onClose}>
      {(close) => (
        <div className="flex flex-col gap-6 px-6 pb-8">
          <div>
            <h2 className="text-[28px] font-semibold leading-tight text-content">
              When would you like to do your quick check-ins
            </h2>
            <p className="mt-2 text-lg font-medium text-slate-500">
              We'll use this to optimize your smart plan.
            </p>
          </div>

          <InfoBox icon={<Lightbulb className="h-5 w-5" />}>
            We recommend doing your check-in 15 minutes after waking up and 15 minutes before
            bedtime.
          </InfoBox>

          <div className="flex flex-col gap-4 pb-4 pt-2">
            <ReminderCard
              emoji="🌅"
              iconBg="bg-[#fef9c3]"
              label="Morning check in"
              time={morningTime}
              onTimeChange={setMorningTime}
              reminderEnabled={morningReminder}
              onToggle={setMorningReminder}
            />
            <ReminderCard
              emoji="🌙"
              iconBg="bg-[#e0e7ff]"
              label="Night check in"
              time={nightTime}
              onTimeChange={setNightTime}
              reminderEnabled={nightReminder}
              onToggle={setNightReminder}
            />
          </div>

          <button
            onClick={close}
            className="w-full rounded-full bg-primary py-4 text-lg font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.3),0px_4px_6px_-4px_rgba(19,91,236,0.3)] transition-colors hover:bg-primary-dark"
          >
            Save Reminders
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
