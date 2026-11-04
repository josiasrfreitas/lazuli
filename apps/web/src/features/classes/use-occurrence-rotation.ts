import { useEffect, useState } from "react";

export const OCCURRENCE_DWELL_MS = 20_000;

/** A full reading interval starts again after any interaction with the page. */
export function useOccurrenceRotation(count: number): {
  index: number;
  paused: boolean;
  automatic: boolean;
  setHovered: (value: boolean) => void;
  setFocused: (value: boolean) => void;
  togglePaused: () => void;
  previous: () => void;
  next: () => void;
} {
  const [position, setPosition] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [playRequested, setPlayRequested] = useState(false);
  const index = count ? position % count : 0;
  const stopped = paused || (reducedMotion && !playRequested);

  useEffect(() => {
    const preference = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (): void => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (count < 2 || stopped || hovered || focused) return;
    return subscribeToInactivity(() => setPosition((current) => (current + 1) % count));
  }, [count, index, stopped, hovered, focused]);

  return {
    index,
    paused: stopped,
    automatic: !stopped && !hovered && !focused,
    setHovered,
    setFocused,
    togglePaused: () => {
      setPlayRequested(true);
      setPaused(!stopped);
    },
    previous: () => setPosition((current) => (current + count - 1) % count),
    next: () => setPosition((current) => (current + 1) % count),
  };
}

function subscribeToInactivity(advance: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = (): void => {
    globalThis.clearTimeout(timer);
    if (document.hidden) return;
    timer = globalThis.setTimeout(() => {
      // A modal task retains attention even while the pointer is at rest.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) schedule();
      else advance();
    }, OCCURRENCE_DWELL_MS);
  };
  schedule();
  const events = [
    "pointerdown",
    "pointermove",
    "keydown",
    "wheel",
    "touchstart",
    "visibilitychange",
  ] as const;
  for (const event of events) document.addEventListener(event, schedule, { passive: true });
  return () => {
    globalThis.clearTimeout(timer);
    for (const event of events) document.removeEventListener(event, schedule);
  };
}
