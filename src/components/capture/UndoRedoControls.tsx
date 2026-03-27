interface UndoRedoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function UndoRedoControls({ canUndo, canRedo, onUndo, onRedo }: UndoRedoControlsProps) {
  return (
    <div className="flex gap-1">
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`rounded-lg px-2 py-1 text-sm transition-all ${
          canUndo
            ? 'bg-surface text-content shadow-sm hover:bg-surface-secondary'
            : 'cursor-not-allowed text-content-tertiary'
        }`}
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`rounded-lg px-2 py-1 text-sm transition-all ${
          canRedo
            ? 'bg-surface text-content shadow-sm hover:bg-surface-secondary'
            : 'cursor-not-allowed text-content-tertiary'
        }`}
        title="Redo (Ctrl+Y)"
      >
        Redo
      </button>
    </div>
  );
}
