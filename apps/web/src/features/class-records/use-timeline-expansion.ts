"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** CSS interpolates the real lane sizes; this hook owns selection and viewport access. */
export function useTimelineExpansion() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [availableShare, setAvailableShare] = useState(1);

  function expand(id: string | null, pointer = false) {
    if (id === expandedId) return;
    const timeline = timelineRef.current;
    const pointerMotion =
      pointer && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (timeline) timeline.dataset.timelineMotion = String(pointerMotion);
    setExpandedId(id);
  }

  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    const viewport = timeline?.closest<HTMLElement>('[role="region"]');
    if (!timeline || !viewport) return;
    const measure = () =>
      setAvailableShare(Math.max(0, viewport.clientWidth - 60) / timeline.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(timeline);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    if (expandedId && window.matchMedia("(max-width: 700px)").matches) {
      const selected = [...timeline.querySelectorAll<HTMLElement>("[data-position]")].find(
        (item) => item.dataset.position === expandedId,
      );
      const viewport = timeline.closest<HTMLElement>('[role="region"]');
      if (selected && viewport) {
        const card = selected.getBoundingClientRect();
        const bounds = viewport.getBoundingClientRect();
        if (card.left < bounds.left + 52 || card.right > bounds.right) {
          viewport.scrollLeft += card.left - bounds.left - 56;
        }
      }
    }
  }, [expandedId]);

  return { timelineRef, expandedId, expand, availableShare };
}
