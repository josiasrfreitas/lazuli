"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** Observe the start of a positioned section without changing native scroll behavior. */
export function useStickyBoundary(enabled: boolean): {
  sentinelRef: RefObject<HTMLSpanElement | null>;
  stuck: boolean;
} {
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!enabled || !sentinel) return;
    const root = scrollAncestor(sentinel);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setStuck(entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0));
      },
      { root, threshold: [0, 1] },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled]);

  return { sentinelRef, stuck: enabled && stuck };
}

function scrollAncestor(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;
  while (parent) {
    if (/auto|scroll|hidden/u.test(getComputedStyle(parent).overflowY)) return parent;
    parent = parent.parentElement;
  }
  return null;
}
