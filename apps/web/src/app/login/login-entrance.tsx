"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import styles from "./login-entrance.module.css";
import { animateEntrance } from "./login-entrance-motion";

const SESSION_KEY = "lazuli:cinematic-entrance-seen";
const ENTRANCE_MOTION = "(prefers-reduced-motion: no-preference)";

/** Progressive enhancement: the server always renders a usable, visible login. */
export function LoginEntrance({
  children,
  skip,
}: {
  children: ReactNode;
  skip: boolean;
}): ReactNode {
  const root = useRef<HTMLElement>(null);
  const flight = useRef<SVGSVGElement>(null);
  const eligible = useRef<boolean | null>(null);

  useLayoutEffect(() => {
    const container = root.current;
    const overlay = flight.current;
    if (container === null || overlay === null) return;

    const media = globalThis.matchMedia(ENTRANCE_MOTION);
    // Retain eligibility during React's development effect replay.
    eligible.current ??= claimEntrance(media.matches, skip);
    if (!eligible.current || !media.matches) {
      return;
    }

    const animations = animateEntrance(container, overlay);
    const stop = (): void => {
      for (const animation of animations) animation.cancel();
    };
    // Finish immediately if the visitor starts using the form or changes viewport/preferences.
    container.addEventListener("focusin", stop);
    container.addEventListener("pointerdown", stop);
    window.addEventListener("resize", stop);
    media.addEventListener("change", stop);
    void Promise.all(animations.map((animation) => animation.finished)).then(stop, stop);

    return () => {
      stop();
      container.removeEventListener("focusin", stop);
      container.removeEventListener("pointerdown", stop);
      window.removeEventListener("resize", stop);
      media.removeEventListener("change", stop);
    };
  }, [skip]);

  return (
    <main ref={root} className={`dark ${styles.entrance}`}>
      <header className={styles.masthead}>
        <p className={styles.signature} role="img" aria-label="Lazuli">
          <img
            className={styles.seal}
            data-login-reveal="seal"
            src="/brand/lazuli-symbol-dark.svg"
            alt=""
            width="100"
            height="100"
          />
          <svg className={styles.wordmark} aria-hidden="true" viewBox="0 0 330 100">
            <image
              data-login-reveal="wordmark"
              height="100"
              href="/brand/lazuli-wordmark-dark.svg"
              width="320"
            />
            <circle data-brand-dot cx="317" cy="69" fill="currentColor" r="5" />
          </svg>
        </p>
      </header>
      {children}
      <svg ref={flight} className={styles.flight} aria-hidden="true" focusable="false">
        <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle r="1" fill="currentColor" />
      </svg>
    </main>
  );
}

function claimEntrance(motionAllowed: boolean, skip: boolean): boolean {
  try {
    const seen = sessionStorage.getItem(SESSION_KEY) !== null;
    sessionStorage.setItem(SESSION_KEY, "1");
    return !seen && motionAllowed && !skip;
  } catch {
    // Without session storage, keep the static screen instead of replaying on every visit.
    return false;
  }
}
