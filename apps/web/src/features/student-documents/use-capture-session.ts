import { useCallback, useEffect, useRef, useState } from "react";
import { captureRequest, type CaptureSession } from "./model";

const CAPTURE_POLL_MS = 2000;

export function useCaptureSession(
  token: string,
  enabled = true,
): {
  session: CaptureSession | null;
  error: string;
  refresh: () => Promise<void>;
} {
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const closed = useRef(false);
  const refresh = useCallback(async (): Promise<void> => {
    if (!token || !enabled) return;
    const current = generation.current;
    try {
      const value = await captureRequest<CaptureSession>(token);
      if (generation.current !== current) return;
      setSession(value);
      setError("");
    } catch (error_) {
      if (generation.current !== current) return;
      closed.current = error_ instanceof Error && error_.message === "EXPIRED";
      setError(closed.current ? "closed" : "connection");
    }
  }, [token, enabled]);
  useEffect(() => {
    generation.current += 1;
    closed.current = false;
    if (!token || !enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll(): Promise<void> {
      await refresh();
      if (!stopped && !closed.current) timer = setTimeout(() => void poll(), CAPTURE_POLL_MS);
    }
    void poll();
    return () => {
      stopped = true;
      generation.current += 1;
      clearTimeout(timer);
    };
  }, [token, enabled, refresh]);
  return { session, error, refresh };
}
