"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/** CSS interpolates the real lane sizes; this hook owns selection and viewport access. */
type TimelineExpansion = {
  timelineRef: RefObject<HTMLDivElement | null>;
  expandedId: string | null;
  expand: (id: string | null, pointer?: boolean) => void;
  availableShare: number;
};
const VIEWPORT_GUTTER = 60;
const TIME_AXIS_WIDTH = 52;
const FOCUS_MARGIN = 56;
export function useTimelineExpansion(): TimelineExpansion {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [availableShare, setAvailableShare] = useState(1);

  function expand(id: string | null, pointer = false): void {
    if (id === expandedId) return;
    const timeline = timelineRef.current;
    const pointerMotion =
      pointer && globalThis.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (timeline) timeline.dataset.timelineMotion = String(pointerMotion);
    setExpandedId(id);
  }

  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    const viewport = timeline?.closest<HTMLElement>('[role="region"]');
    if (!timeline || !viewport) return;
    const measure = (): void =>
      setAvailableShare(Math.max(0, viewport.clientWidth - VIEWPORT_GUTTER) / timeline.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(timeline);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    if (expandedId && globalThis.matchMedia("(max-width: 700px)").matches) {
      const selected = [...timeline.querySelectorAll<HTMLElement>("[data-position]")].find(
        (item) => item.dataset.position === expandedId,
      );
      const viewport = timeline.closest<HTMLElement>('[role="region"]');
      if (selected && viewport) {
        const card = selected.getBoundingClientRect();
        const bounds = viewport.getBoundingClientRect();
        if (card.left < bounds.left + TIME_AXIS_WIDTH || card.right > bounds.right) {
          viewport.scrollLeft += card.left - bounds.left - FOCUS_MARGIN;
        }
      }
    }
  }, [expandedId]);

  return { timelineRef, expandedId, expand, availableShare };
}
