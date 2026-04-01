import { Icon } from '@iconify/react';
import { useCallback, useEffect, useState } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = useCallback(
    (confirmed: boolean) => {
      if (isLoading) return;
      setVisible(false);
      setTimeout(() => (confirmed ? onConfirm() : onCancel()), 200);
    },
    [onConfirm, onCancel, isLoading],
  );

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-200 ${visible ? 'opacity-40' : 'opacity-0'}`}
        onClick={() => handleClose(false)}
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
            onClick={() => handleClose(true)}
            disabled={isLoading}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors ${
              isLoading
                ? isDanger
                  ? 'cursor-not-allowed bg-danger/60'
                  : 'cursor-not-allowed bg-primary/60'
                : isDanger
                  ? 'bg-danger active:bg-danger/80'
                  : 'bg-primary active:bg-primary/80'
            }`}
          >
            {isLoading && <Icon icon="svg-spinners:ring-resize" width={16} />}
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={() => handleClose(false)}
            disabled={isLoading}
            className="w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold text-content transition-colors active:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
