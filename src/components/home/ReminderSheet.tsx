import { Bell, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { track } from '@/analytics';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { InfoBox } from '@/components/ui/InfoBox';
import { TimePicker } from '@/components/ui/TimePicker';
import { Toggle } from '@/components/ui/Toggle';

interface ReminderSheetProps {
  onClose: () => void;
  initialMorningTime?: string;
  initialNightTime?: string;
  initialPushNotifications?: boolean;
  onSave?: (data: { morningTime: string; nightTime: string; pushNotifications: boolean }) => void;
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
    <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 p-[17px] shadow-sm">
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

export function ReminderSheet({
  onClose,
  initialMorningTime = '07:15',
  initialNightTime = '21:50',
  initialPushNotifications = true,
  onSave,
}: ReminderSheetProps) {
  const [morningTime, setMorningTime] = useState(initialMorningTime);
  const [nightTime, setNightTime] = useState(initialNightTime);
  const [morningReminder, setMorningReminder] = useState(true);
  const [nightReminder, setNightReminder] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(initialPushNotifications);

  const handleSave = (close: () => void) => {
    // Emit per-time change events so analytics can distinguish morning vs
    // night schedule tweaks (spec §5.1 `update_checkin_schedule`).
    if (morningTime !== initialMorningTime) {
      track('update_checkin_schedule', {
        checkin_type: 'morning',
        old_time: initialMorningTime,
        new_time: morningTime,
      });
    }
    if (nightTime !== initialNightTime) {
      track('update_checkin_schedule', {
        checkin_type: 'night',
        old_time: initialNightTime,
        new_time: nightTime,
      });
    }
    if (pushNotifications !== initialPushNotifications) {
      track('toggle_push_notifications', { enabled: pushNotifications });
    }
    onSave?.({ morningTime, nightTime, pushNotifications });
    close();
  };

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

            {/* Push Notifications */}
            <div className="flex items-center justify-between rounded-2xl border border-gray-100 p-[17px] shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f0fdf4]">
                  <Bell className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-base font-bold text-content">Push Notifications</span>
              </div>
              <Toggle checked={pushNotifications} onChange={setPushNotifications} />
            </div>
          </div>

          <button
            onClick={() => handleSave(close)}
            className="w-full rounded-full bg-primary py-4 text-lg font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.3),0px_4px_6px_-4px_rgba(19,91,236,0.3)] transition-colors hover:bg-primary-dark"
          >
            Save Reminders
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
