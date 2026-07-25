"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Generic undo/redo stack with refs so undo/redo never read stale closures.
 */
export function useUndoRedo<T>(initial: T) {
  const pastRef = useRef<T[]>([]);
  const presentRef = useRef<T>(initial);
  const futureRef = useRef<T[]>([]);

  const [present, setPresent] = useState<T>(initial);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const set = useCallback(
    (next: T, options?: { skipHistory?: boolean }) => {
      if (options?.skipHistory) {
        presentRef.current = next;
        setPresent(next);
        return;
      }
      pastRef.current = [...pastRef.current, presentRef.current];
      presentRef.current = next;
      futureRef.current = [];
      setPresent(next);
      syncFlags();
    },
    [syncFlags]
  );

  const replace = useCallback(
    (next: T) => {
      pastRef.current = [];
      presentRef.current = next;
      futureRef.current = [];
      setPresent(next);
      syncFlags();
    },
    [syncFlags]
  );

  const undo = useCallback((): T | null => {
    if (pastRef.current.length === 0) return null;
    const previous = pastRef.current[pastRef.current.length - 1]!;
    futureRef.current = [presentRef.current, ...futureRef.current];
    pastRef.current = pastRef.current.slice(0, -1);
    presentRef.current = previous;
    setPresent(previous);
    syncFlags();
    return previous;
  }, [syncFlags]);

  const redo = useCallback((): T | null => {
    if (futureRef.current.length === 0) return null;
    const next = futureRef.current[0]!;
    pastRef.current = [...pastRef.current, presentRef.current];
    futureRef.current = futureRef.current.slice(1);
    presentRef.current = next;
    setPresent(next);
    syncFlags();
    return next;
  }, [syncFlags]);

  const getPresent = useCallback(() => presentRef.current, []);

  return {
    present,
    canUndo,
    canRedo,
    set,
    replace,
    undo,
    redo,
    getPresent,
  };
}
