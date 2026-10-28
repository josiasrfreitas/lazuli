import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";

const SECTION_ORDER = ["visao-geral", "cadastro", "pedagogico", "planejamento", "financeiro"];

/** Snapshot the departing panel so only the selected section stays mounted. */
export function useSectionCarousel() {
  const transitionRef = useRef<ViewTransition | null>(null);

  useEffect(
    () => () => {
      transitionRef.current?.skipTransition();
    },
    [],
  );

  return (current: string, next: string, update: () => void) => {
    if (current === next) return;
    transitionRef.current?.skipTransition();

    if (
      !document.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      update();
      return;
    }

    document.documentElement.dataset.studentCarousel =
      SECTION_ORDER.indexOf(next) > SECTION_ORDER.indexOf(current) ? "forward" : "backward";
    const transition = document.startViewTransition(() => {
      flushSync(update);
    });
    transitionRef.current = transition;
    void transition.finished
      .catch(() => undefined)
      .finally(() => {
        if (transitionRef.current !== transition) return;
        transitionRef.current = null;
        delete document.documentElement.dataset.studentCarousel;
      });
  };
}
