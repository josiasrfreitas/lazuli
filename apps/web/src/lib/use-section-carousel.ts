import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";

type CarouselOptions = { order: readonly string[]; scope: "studentCarousel" | "classCarousel" };

/** Snapshot the departing panel so only the selected section stays mounted. */
export function useSectionCarousel({ order, scope }: CarouselOptions) {
  const transitionRef = useRef<ViewTransition | null>(null);
  const generation = useRef(0);

  useEffect(
    () => () => {
      generation.current += 1;
      transitionRef.current?.skipTransition();
    },
    [],
  );

  return (current: string, { next, update }: { next: string; update: () => void }) => {
    const request = ++generation.current;
    transitionRef.current?.skipTransition();
    // A click back to the visible section must also supersede a pending snapshot update.
    if (current === next) {
      update();
      return;
    }

    if (
      !document.startViewTransition ||
      globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      update();
      return;
    }

    document.documentElement.setAttribute(
      scope === "classCarousel" ? "data-class-carousel" : "data-student-carousel",
      order.indexOf(next) > order.indexOf(current) ? "forward" : "backward",
    );
    const transition = document.startViewTransition(() => {
      if (request === generation.current) flushSync(update);
    });
    transitionRef.current = transition;
    // Skipping a snapshot rejects ready independently of finished. Observe both promises.
    void transition.ready.catch(() => {});
    void transition.updateCallbackDone.catch(() => {});
    void transition.finished
      .catch(() => {})
      .finally(() => {
        if (transitionRef.current !== transition) return;
        transitionRef.current = null;
        document.documentElement.removeAttribute(
          scope === "classCarousel" ? "data-class-carousel" : "data-student-carousel",
        );
      });
  };
}
