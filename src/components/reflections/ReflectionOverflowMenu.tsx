import { Icon } from '@iconify/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConfirmDialog } from '@/components/settings/ConfirmDialog';

interface ReflectionOverflowMenuProps {
  onEdit: () => void;
  onDelete: () => void;
}

type Coords = { top: number; right: number };

export function ReflectionOverflowMenu({ onEdit, onDelete }: ReflectionOverflowMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open) return;
    const el = buttonRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const handleDeleteClick = () => {
    close();
    setConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    setConfirmOpen(false);
    onDelete();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded-full text-content-secondary transition-colors hover:bg-surface"
      >
        <Icon icon="mdi:dots-horizontal" width={20} height={20} />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            className="animate-in fade-in zoom-in-95 fixed z-50 min-w-[200px] origin-top-right overflow-hidden rounded-2xl border border-border-light/40 bg-surface-secondary py-1 shadow-[0_12px_32px_rgba(0,0,0,0.35)] duration-100"
            style={{ top: coords.top, right: coords.right }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onEdit();
                close();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-content hover:bg-surface"
            >
              <Icon icon="mdi:pencil-outline" width={18} height={18} />
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleDeleteClick}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-danger hover:bg-surface"
            >
              <Icon icon="mdi:delete-outline" width={18} height={18} />
              Delete
            </button>
          </div>,
          document.body,
        )}

      {confirmOpen && (
        <ConfirmDialog
          title="Delete this reflection?"
          message="This will permanently remove the entry and anything written in it. This can't be undone."
          confirmLabel="Delete reflection"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}
