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
        className={`px-2 py-1 text-sm rounded-lg transition-all ${
          canUndo ? 'text-content bg-surface hover:bg-surface-secondary shadow-sm' : 'text-content-tertiary cursor-not-allowed'
        }`}
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`px-2 py-1 text-sm rounded-lg transition-all ${
          canRedo ? 'text-content bg-surface hover:bg-surface-secondary shadow-sm' : 'text-content-tertiary cursor-not-allowed'
        }`}
        title="Redo (Ctrl+Y)"
      >
        Redo
      </button>
    </div>
  );
}
