"use client";

import { useEffect, useRef, useState } from "react";

/** Resize only the surface; labels and controls never stretch with the dialog. */
export function useDialogExpansion() {
  const [dialog, dialogRef] = useState<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!dialog || !surface) return;
    let previous: { width: number; height: number } | undefined;
    let animation: Animation | undefined;
    let reveal: Animation | undefined;
    let pointer = false;
    const keyboard = () => {
      pointer = false;
    };
    const pointing = () => {
      pointer = true;
    };
    dialog.addEventListener("keydown", keyboard, true);
    dialog.addEventListener("pointerdown", pointing, true);
    const observer = new ResizeObserver(() => {
      const next = { width: dialog.offsetWidth, height: dialog.offsetHeight };
      if (previous && (previous.width !== next.width || previous.height !== next.height)) {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(surface).transform);
        const width = previous.width * matrix.a;
        const height = previous.height * matrix.d;
        animation?.cancel();
        reveal?.cancel();
        if (pointer && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
          const tokens = getComputedStyle(dialog);
          const duration = parseFloat(tokens.getPropertyValue("--lz-duration-slow")) || 280;
          const easing = tokens.getPropertyValue("--lz-ease-standard").trim();
          if (next.height > height)
            reveal = dialog.animate(
              [
                { clipPath: `inset(0 0 ${Math.max(0, next.height - height)}px 0)` },
                { clipPath: "inset(0 0 0 0)" },
              ],
              { duration, easing },
            );
          animation = surface.animate(
            [
              { transform: `scale(${width / next.width}, ${height / next.height})` },
              { transform: "scale(1, 1)" },
            ],
            {
              duration,
              easing,
            },
          );
        }
      }
      previous = next;
    });
    observer.observe(dialog);
    return () => {
      observer.disconnect();
      animation?.cancel();
      reveal?.cancel();
      dialog.removeEventListener("keydown", keyboard, true);
      dialog.removeEventListener("pointerdown", pointing, true);
    };
  }, [dialog]);
  return { dialogRef, surfaceRef };
}
