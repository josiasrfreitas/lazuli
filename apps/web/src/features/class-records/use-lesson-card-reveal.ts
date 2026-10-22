"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

const MILLISECONDS_PER_SECOND = 1000;
const CONTENT_WIDTH_PROPERTY = "--agenda-content-width";

/** Measure once at the destination width, then let CSS move both axes together. */
export function useLessonCardReveal(
  dayWidth?: number,
  widthShare?: number,
): RefObject<HTMLButtonElement | null> {
  const ref = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const card = ref.current;
    const event = card?.closest<HTMLElement>(".rbc-event");
    const day = event?.closest<HTMLElement>(".rbc-day-slot");
    const lanes = event?.parentElement;
    if (!card || !event || !day || !lanes) return;
    if (dayWidth && widthShare) {
      openReveal({ card, event, day, lanes, dayWidth, widthShare });
      return;
    }
    return closeReveal(card, event);
  }, [dayWidth, widthShare]);

  return ref;
}

function resetReveal(card: HTMLButtonElement): void {
  delete card.dataset.reveal;
  card.style.removeProperty("height");
  card.style.removeProperty(CONTENT_WIDTH_PROPERTY);
}

function openReveal({
  card,
  event,
  day,
  lanes,
  dayWidth,
  widthShare,
}: {
  card: HTMLButtonElement;
  event: HTMLElement;
  day: HTMLElement;
  lanes: HTMLElement;
  dayWidth: number;
  widthShare: number;
}): void {
  const currentHeight = card.getBoundingClientRect().height;
  const laneStyle = getComputedStyle(lanes);
  const dayInset =
    day.getBoundingClientRect().width -
    lanes.getBoundingClientRect().width +
    Number.parseFloat(laneStyle.borderLeftWidth) +
    Number.parseFloat(laneStyle.borderRightWidth);
  const eventInset = event.getBoundingClientRect().width - card.getBoundingClientRect().width;
  // weeklyDayLayout reserves two pixels between lanes; retain the event's borders too.
  const width = (dayWidth - dayInset) * widthShare - 2 - eventInset;
  const size = measureContent(card, width);
  card.style.height = `${currentHeight}px`;
  card.dataset.reveal = "true";
  card.style.setProperty(CONTENT_WIDTH_PROPERTY, `${size.width}px`);
  // Commit the current height before the destination. Reversals start at the visible size.
  card.getBoundingClientRect();
  card.style.height = `${Math.max(card.parentElement!.clientHeight, size.height)}px`;
}

function closeReveal(card: HTMLButtonElement, event: HTMLElement): (() => void) | undefined {
  if (!card.dataset.reveal) return;
  card.style.height = `${card.parentElement!.clientHeight}px`;
  const duration = Math.max(
    ...getComputedStyle(card)
      .transitionDuration.split(",")
      .map((value) => Number.parseFloat(value) * MILLISECONDS_PER_SECOND),
  );
  if (!duration || event.dataset.weekRevealed === "true") {
    resetReveal(card);
    return;
  }
  // Keep the destination text layout during closing; never re-wrap on every frame.
  const closing = globalThis.setTimeout(() => resetReveal(card), duration);
  return () => globalThis.clearTimeout(closing);
}

function measureContent(card: HTMLButtonElement, width: number): { height: number; width: number } {
  const probe = card.cloneNode(true) as HTMLButtonElement;
  probe.inert = true;
  probe.setAttribute("aria-hidden", "true");
  probe.dataset.reveal = "true";
  Object.assign(probe.style, {
    position: "absolute",
    visibility: "hidden",
    pointerEvents: "none",
    transition: "none",
    width: `${width}px`,
    height: "max-content",
    minHeight: "0",
  });
  probe.style.setProperty(CONTENT_WIDTH_PROPERTY, "100%");
  card.parentElement!.append(probe);
  const size = {
    height: probe.getBoundingClientRect().height,
    width: probe.firstElementChild!.getBoundingClientRect().width,
  };
  probe.remove();
  return size;
}
