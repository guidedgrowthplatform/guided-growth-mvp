import { useState, useCallback, useRef } from 'react';

const MAX_UNDO_STACK = 50;

export function useUndoRedo<T>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  // Counter to force re-renders when refs change
  const [, setVersion] = useState(0);
  const bumpVersion = useCallback(() => setVersion((v) => v + 1), []);

  const pushHistory = useCallback(() => {
    pastRef.current = [...pastRef.current.slice(-MAX_UNDO_STACK + 1), state];
    futureRef.current = [];
    bumpVersion();
  }, [state, bumpVersion]);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [state, ...futureRef.current];
    setState(previous);
    bumpVersion();
  }, [state, bumpVersion]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current, state];
    setState(next);
    bumpVersion();
  }, [state, bumpVersion]);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  return { state, setState, pushHistory, undo, redo, canUndo, canRedo };
}
