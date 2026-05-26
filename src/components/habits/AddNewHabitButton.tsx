import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { Button } from '@/components/ui/Button';

export function AddNewHabitButton() {
  const navigate = useNavigate();
  return (
    <Button
      variant="primary"
      size="auth"
      fullWidth
      className="rounded-full text-[18px] font-bold shadow-[0px_20px_25px_-5px_rgba(19,91,236,0.25),0px_8px_10px_-6px_rgba(19,91,236,0.25)]"
      onClick={() => {
        track('tap_create_habit', { source: 'habits_footer' });
        navigate('/add-habit');
      }}
    >
      <Icon icon="mdi:plus" width={20} height={20} />
      Add New Habit
    </Button>
  );
}
