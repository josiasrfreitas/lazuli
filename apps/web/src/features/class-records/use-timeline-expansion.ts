"use client";

import { useLayoutEffect, useRef, useState } from "react";

const TIMELINE_VIEWPORT_RESERVE = 60;
const CARD_VISIBILITY_INSET = 52;
const CARD_SCROLL_INSET = 56;

/** CSS interpolates the real lane sizes; this hook owns selection and viewport access. */
export function useTimelineExpansion() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [availableShare, setAvailableShare] = useState(1);

  function expand(id: string | null, pointer = false): void {
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
    const measure = (): void =>
      setAvailableShare(
        Math.max(0, viewport.clientWidth - TIMELINE_VIEWPORT_RESERVE) / timeline.clientWidth,
      );
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
        if (card.left < bounds.left + CARD_VISIBILITY_INSET || card.right > bounds.right) {
          viewport.scrollLeft += card.left - bounds.left - CARD_SCROLL_INSET;
        }
      }
    }
  }, [expandedId]);

  return { timelineRef, expandedId, expand, availableShare };
}
