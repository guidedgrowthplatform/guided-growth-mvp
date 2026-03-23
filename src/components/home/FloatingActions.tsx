import { CheckSquare, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function FloatingActions() {
  const navigate = useNavigate();

  return (
    <div className="pointer-events-auto fixed bottom-24 right-6 z-30 flex flex-col items-center gap-3 lg:hidden">
      <button
        onClick={() => navigate('/habits')}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg"
      >
        <CheckSquare className="h-5 w-5 text-white" />
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-primary bg-surface text-[10px] text-primary">
          +
        </span>
      </button>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('toggle-journal'))}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg"
      >
        <BookOpen className="h-5 w-5 text-white" />
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-primary bg-surface text-[10px] text-primary">
          +
        </span>
      </button>
    </div>
  );
}
