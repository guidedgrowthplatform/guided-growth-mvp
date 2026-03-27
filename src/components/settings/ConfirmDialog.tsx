import { Icon } from '@iconify/react';
import { useCallback, useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleCancel = useCallback(() => {
    if (loading) return;
    setVisible(false);
    setTimeout(() => onCancel(), 200);
  }, [onCancel, loading]);

  const handleConfirm = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onConfirm();
    } catch {
      setLoading(false);
    }
  }, [onConfirm, loading]);

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-200 ${visible ? 'opacity-40' : 'opacity-0'}`}
        onClick={handleCancel}
      />
      <div
        className={`relative w-full max-w-sm rounded-3xl bg-surface p-6 shadow-xl transition-all duration-200 ${
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="mb-4 flex justify-center">
          <div className={`rounded-full p-3 ${isDanger ? 'bg-danger/10' : 'bg-primary/10'}`}>
            <Icon
              icon={isDanger ? 'ic:round-warning' : 'ic:round-info'}
              width={32}
              className={isDanger ? 'text-danger' : 'text-primary'}
            />
          </div>
        </div>
        <h3 className="text-center text-lg font-bold text-content">{title}</h3>
        <p className="mt-2 text-center text-sm text-content-secondary">{message}</p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-70 ${
              isDanger ? 'bg-danger active:bg-danger/80' : 'bg-primary active:bg-primary/80'
            }`}
          >
            {loading ? (
              <LoadingSpinner size="sm" className="border-white border-t-transparent" />
            ) : (
              confirmLabel
            )}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold text-content transition-colors active:bg-surface-secondary disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
