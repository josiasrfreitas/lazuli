"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

const TRAVEL_PX = 14;
const REDUCED_DURATION_MS = 100;
const DURATION_MS = 220;

/** A short, interruptible transition follows movement through calendar time. */
export function useCalendarMotion(
  position: number,
  scope: string,
): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef({ position, scope });
  useLayoutEffect(() => {
    const prior = previous.current;
    previous.current = { position, scope };
    if (!ref.current || (prior.position === position && prior.scope === scope)) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const direction = position >= prior.position ? 1 : -1;
    const animation = ref.current.animate(
      reduced
        ? [{ opacity: 0.7 }, { opacity: 1 }]
        : [
            { opacity: 0.55, transform: `translateX(${direction * TRAVEL_PX}px)` },
            { opacity: 1, transform: "translateX(0)" },
          ],
      {
        duration: reduced ? REDUCED_DURATION_MS : DURATION_MS,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    );
    return () => animation.cancel();
  }, [position, scope]);
  return ref;
}
