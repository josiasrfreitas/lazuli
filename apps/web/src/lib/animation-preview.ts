"use client";

import { useEffect, useState } from "react";
import { isDevelopment } from "./env";

/** Temporary pacing for reviewing entrances locally; production has no added wait. */
export function useAnimationPreviewDelay(milliseconds: number): boolean {
  const [ready, setReady] = useState(!isDevelopment);

  useEffect(() => {
    if (!isDevelopment) return;
    const timeout = globalThis.setTimeout(() => setReady(true), milliseconds);
    return () => globalThis.clearTimeout(timeout);
  }, [milliseconds]);

  return ready;
}

export function waitForAnimationPreview(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (!isDevelopment || signal.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const finish = (): void => {
      globalThis.clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = globalThis.setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish, { once: true });
  });
}
