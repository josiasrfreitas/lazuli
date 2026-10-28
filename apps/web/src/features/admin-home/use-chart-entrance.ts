import { useEffect, useState, useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
function subscribe(callback: () => void): () => void {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const reducedMotion = (): boolean => window.matchMedia(query).matches;
const serverSnapshot = (): boolean => true;

/** Animate the initial reveal, never the dashboard's background refresh. */
export function useChartEntrance(): boolean {
  const reduced = useSyncExternalStore(subscribe, reducedMotion, serverSnapshot);
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const timeout = window.setTimeout(() => setEntering(false), 1400);
    return () => window.clearTimeout(timeout);
  }, []);
  return entering && !reduced;
}
