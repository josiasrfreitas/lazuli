"use client";

import { useEffect, useRef, useState } from "react";

/** URL acknowledgements must never replace a newer keystroke. */
export function useSearchDraft(
  search: string,
  onCommit: (value: string) => void,
  delay = 300,
): readonly [string, (next: string) => void] {
  const [value, setValue] = useState(search);
  const commit = useRef(onCommit);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acknowledgements = useRef<string[]>([]);
  commit.current = onCommit;

  useEffect(() => {
    const index = acknowledgements.current.findIndex((sent) => sent.trim() === search.trim());
    if (index >= 0) {
      acknowledgements.current.splice(0, index + 1);
      return;
    }
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    acknowledgements.current = [];
    setValue(search);
  }, [search]);

  useEffect(() => {
    function cancelPending(): void {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
      acknowledgements.current = [];
    }
    window.addEventListener("popstate", cancelPending);
    return () => {
      cancelPending();
      window.removeEventListener("popstate", cancelPending);
    };
  }, []);

  function change(next: string): void {
    setValue(next);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (next === search) return;
      acknowledgements.current.push(next);
      commit.current(next);
    }, delay);
  }

  return [value, change] as const;
}
