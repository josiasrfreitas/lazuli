"use client";

import { useLayoutEffect, useRef } from "react";

/** A short, interruptible transition follows movement through calendar time. */
export function useCalendarMotion(position: number, scope: string) {
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
            { opacity: 0.55, transform: `translateX(${direction * 14}px)` },
            { opacity: 1, transform: "translateX(0)" },
          ],
      { duration: reduced ? 100 : 220, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
    return () => animation.cancel();
  }, [position, scope]);
  return ref;
}
