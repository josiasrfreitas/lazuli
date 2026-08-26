import { useEffect, useRef, type RefObject } from "react";

/**
 * The dialog body scrolls, so a failed submit can leave the offending field
 * (typically the guardian section) below the fold with no visible feedback.
 * Whenever `revision` bumps — once per failed submit, see the reducer — this
 * brings the first invalid control into view and focuses it.
 */
export function useScrollToError(revision: number): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (revision === 0) {
      return;
    }

    const invalid = containerRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');

    if (invalid !== undefined && invalid !== null) {
      invalid.scrollIntoView({ block: "center" });
      invalid.focus({ preventScroll: true });
    }
  }, [revision]);

  return containerRef;
}
