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
          canUndo ? 'text-slate-600 hover:bg-slate-100/50' : 'text-slate-300 cursor-not-allowed'
        }`}
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`px-2 py-1 text-sm rounded-lg transition-all ${
          canRedo ? 'text-slate-600 hover:bg-slate-100/50' : 'text-slate-300 cursor-not-allowed'
        }`}
        title="Redo (Ctrl+Y)"
      >
        Redo
      </button>
    </div>
  );
}
