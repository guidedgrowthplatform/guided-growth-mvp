import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function AuthBackButton() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-border-light"
    >
      <ArrowLeft className="h-5 w-5 text-content" />
    </button>
  );
}
