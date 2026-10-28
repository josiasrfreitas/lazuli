"use client";

import { useEffect, useState } from "react";

/** Temporary pacing for reviewing entrances locally; production has no added wait. */
export function useAnimationPreviewDelay(milliseconds: number): boolean {
  const [ready, setReady] = useState(process.env.NODE_ENV !== "development");

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const timeout = window.setTimeout(() => setReady(true), milliseconds);
    return () => window.clearTimeout(timeout);
  }, [milliseconds]);

  return ready;
}

export function waitForAnimationPreview(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (process.env.NODE_ENV !== "development" || signal.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const finish = (): void => {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = window.setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish, { once: true });
  });
}
