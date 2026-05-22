import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';

export function AuthBackButton() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface shadow-card"
    >
      <Icon icon="ic:round-arrow-back" width={16} height={16} className="text-content" />
    </button>
  );
}
