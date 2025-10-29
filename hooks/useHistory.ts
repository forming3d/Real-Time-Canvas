import { useCallback, useRef, useState } from 'react';

export default function useHistory<T>(initial: T[]) {
  const [list, setList] = useState<T[]>(initial);
  const past = useRef<T[][]>([]);
  const future = useRef<T[][]>([]);

  const push = useCallback((fn: (prev: T[]) => T[]) => {
    setList((prev) => {
      past.current.push(prev);
      future.current = [];
      return fn(prev);
    });
  }, []);

  const undo = useCallback(() => {
    const p = past.current.pop();
    if (p) {
      future.current.push(list);
      setList(p);
    }
  }, [list]);

  const redo = useCallback(() => {
    const f = future.current.pop();
    if (f) {
      past.current.push(list);
      setList(f);
    }
  }, [list]);

  const clear = useCallback(() => {
    past.current.push(list);
    future.current = [];
    setList([]);
  }, [list]);

  return [list, push, undo, redo, clear] as const;
}
