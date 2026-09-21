'use client';
import { useCallback, useRef, useState } from 'react';

type State<T> = { past: T[]; present: T; future: T[] };
const LIMIT = 60;

/**
 * Undo/redo. `set(v)` records a step; `setLive(v)` changes the value without recording
 * (used while dragging) and `commit()` records the drag as one step when it ends.
 */
export function useHistory<T>(initial: T) {
  const [state, setState] = useState<State<T>>({ past: [], present: initial, future: [] });
  const base = useRef<T | null>(null);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setState((s) => {
      const value = typeof next === 'function' ? (next as (p: T) => T)(s.present) : next;
      if (value === s.present) return s;
      return { past: [...s.past, s.present].slice(-LIMIT), present: value, future: [] };
    });
  }, []);

  const setLive = useCallback((next: T | ((prev: T) => T)) => {
    setState((s) => {
      if (base.current === null) base.current = s.present;
      const value = typeof next === 'function' ? (next as (p: T) => T)(s.present) : next;
      return { ...s, present: value };
    });
  }, []);

  const commit = useCallback(() => {
    setState((s) => {
      const b = base.current;
      base.current = null;
      if (b === null || b === s.present) return s;
      return { past: [...s.past, b].slice(-LIMIT), present: s.present, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setState((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s));
  }, []);

  const redo = useCallback(() => {
    setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s));
  }, []);

  const reset = useCallback((value: T) => setState({ past: [], present: value, future: [] }), []);

  return { value: state.present, set, setLive, commit, undo, redo, reset, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
