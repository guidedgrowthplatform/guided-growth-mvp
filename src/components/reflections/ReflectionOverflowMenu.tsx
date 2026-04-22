import { Icon } from '@iconify/react';
import { useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';

interface ReflectionOverflowMenuProps {
  onEdit: () => void;
  onDelete: () => void;
}

export function ReflectionOverflowMenu({ onEdit, onDelete }: ReflectionOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const close = () => {
    setOpen(false);
    setConfirmingDelete(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="More actions"
        className="flex size-8 items-center justify-center rounded-full text-content-secondary hover:bg-surface"
      >
        <Icon icon="mdi:dots-horizontal" width={18} height={18} />
      </button>
      {open && (
        <BottomSheet onClose={close}>
          {(dismiss) => (
            <div className="flex flex-col gap-2 p-4">
              {confirmingDelete ? (
                <>
                  <p className="px-2 pb-2 text-sm font-semibold text-content">
                    Delete this reflection?
                  </p>
                  <p className="px-2 pb-4 text-xs text-content-secondary">This can't be undone.</p>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete();
                      dismiss();
                    }}
                    className="rounded-xl bg-danger py-3 text-sm font-semibold text-white"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-xl bg-surface py-3 text-sm font-semibold text-content"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onEdit();
                      dismiss();
                    }}
                    className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 text-left text-sm font-medium text-content"
                  >
                    <Icon icon="mdi:pencil-outline" width={18} height={18} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 text-left text-sm font-medium text-danger"
                  >
                    <Icon icon="mdi:delete-outline" width={18} height={18} />
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={dismiss}
                    className="mt-1 rounded-xl bg-surface py-3 text-sm font-semibold text-content-secondary"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </BottomSheet>
      )}
    </>
  );
}
