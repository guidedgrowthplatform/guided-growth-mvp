import { useToast } from '@/contexts/ToastContext';

const typeStyles = {
  success: 'bg-emerald-500 text-white',
  error: 'bg-red-500 text-white',
  info: 'bg-cyan-500 text-white',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 lg:bottom-6 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-slide-in ${typeStyles[toast.type]}`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="opacity-70 hover:opacity-100 text-lg leading-none"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
