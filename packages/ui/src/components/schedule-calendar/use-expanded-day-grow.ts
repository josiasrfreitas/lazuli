"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import type { CalendarView } from "./types";

const WEEK_DAYS = 7;
const NEIGHBOR_SPACE = 96;
const DEFAULT_MAX_DAY_WIDTH = 512;

/** Convert a pixel target to the flex share used by the existing expansion transition. */
export function useExpandedDayGrow({
  timelineRef,
  view,
  preferredWidth,
  dayCount = WEEK_DAYS,
}: {
  timelineRef: RefObject<HTMLDivElement | null>;
  view: CalendarView;
  preferredWidth: number | null;
  dayCount?: number;
}): { grow: number; width: number } {
  const [daysWidth, setDaysWidth] = useState(0);

  useLayoutEffect(() => {
    if (view !== "week") return;
    const viewport = timelineRef.current;
    if (!viewport) return;
    // The gutter may mount after the surface without resizing its viewport.
    const measure = (): boolean => {
      const content = viewport.querySelector<HTMLElement>(".rbc-time-content");
      const gutter = content?.querySelector<HTMLElement>(".rbc-time-gutter");
      if (!content || !gutter) return false;
      setDaysWidth(content.clientWidth - gutter.getBoundingClientRect().width);
      return true;
    };
    const mounting = new MutationObserver(() => {
      if (measure()) mounting.disconnect();
    });
    if (!measure()) mounting.observe(viewport, { childList: true, subtree: true });
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => {
      observer.disconnect();
      mounting.disconnect();
    };
  }, [timelineRef, view]);

  if (dayCount <= 1) return { grow: 1, width: daysWidth };
  if (daysWidth <= NEIGHBOR_SPACE) return { grow: 2, width: 0 };
  // Preserve the ordinary card's two shares and 32rem cap when no width is requested.
  const requestedWidth =
    preferredWidth ?? Math.min(DEFAULT_MAX_DAY_WIDTH, (2 * daysWidth) / (dayCount + 1));
  const target = Math.max(
    daysWidth / dayCount,
    Math.min(requestedWidth, daysWidth - NEIGHBOR_SPACE),
  );
  // Each remaining day keeps one flex share.
  return { grow: ((dayCount - 1) * target) / (daysWidth - target), width: target };
}
