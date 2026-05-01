import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';

export function AddNewHabitButton() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        track('tap_create_habit', { source: 'habits_footer' });
        navigate('/add-habit');
      }}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-semibold text-white shadow-sm transition-opacity active:bg-primary/90"
    >
      <Icon icon="mdi:plus" width={20} height={20} />
      Add New Habit
    </button>
  );
}
