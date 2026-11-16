import { useLayoutEffect, useRef, type RefObject } from "react";

const MILLISECONDS_PER_SECOND = 1000;

/** Capture before changing mode, then FLIP the surface without animating layout. */
export function useOccurrenceResize(
  outside: boolean,
  body: RefObject<HTMLDivElement | null>,
): () => void {
  const previous = useRef<DOMRect | null>(null);
  const animation = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const dialog = body.current?.closest<HTMLElement>('[data-slot="dialog-content"]');
    const before = previous.current;
    previous.current = null;
    if (!dialog || !before) return;
    animation.current?.cancel();
    const rect = dialog.getBoundingClientRect();
    const tokens = getComputedStyle(dialog);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    animation.current = dialog.animate(
      reduced
        ? [{ opacity: 0.85 }, { opacity: 1 }]
        : [
            {
              transform: `scale(${before.width / rect.width}, ${before.height / rect.height})`,
              opacity: 0.85,
            },
            { transform: "scale(1)", opacity: 1 },
          ],
      {
        duration: tokenMilliseconds(
          tokens.getPropertyValue(reduced ? "--lz-duration-fast" : "--lz-duration-slow"),
        ),
        easing: tokens.getPropertyValue("--lz-ease-standard").trim(),
      },
    );
    return () => animation.current?.cancel();
  }, [outside, body]);
  return () => {
    previous.current =
      body.current?.closest<HTMLElement>('[data-slot="dialog-content"]')?.getBoundingClientRect() ??
      null;
  };
}

function tokenMilliseconds(value: string): number {
  return Number.parseFloat(value) * (value.trim().endsWith("ms") ? 1 : MILLISECONDS_PER_SECOND);
}
