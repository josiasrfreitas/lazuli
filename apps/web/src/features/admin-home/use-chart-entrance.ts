import { useEffect, useState, useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const ENTRANCE_DURATION = 1400;
function subscribe(callback: () => void): () => void {
  const media = globalThis.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const reducedMotion = (): boolean => globalThis.matchMedia(query).matches;
const serverSnapshot = (): boolean => true;

/** Animate the initial reveal, never the dashboard's background refresh. */
export function useChartEntrance(): boolean {
  const reduced = useSyncExternalStore(subscribe, reducedMotion, serverSnapshot);
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const timeout = globalThis.setTimeout(() => setEntering(false), ENTRANCE_DURATION);
    return () => globalThis.clearTimeout(timeout);
  }, []);
  return entering && !reduced;
}
