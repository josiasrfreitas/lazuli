"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import styles from "./login-entrance.module.css";
import { animateEntrance } from "./login-entrance-motion";

const SESSION_KEY = "lazuli:login-entrance-seen";
const DESKTOP_MOTION = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";
const PENDING_ATTRIBUTE = "data-login-entrance-pending";
// Runs while parsing the server HTML, before the brand can be painted or React hydrates.
const ENTRANCE_BOOTSTRAP = `try {
  if (window.matchMedia(${JSON.stringify(DESKTOP_MOTION)}).matches &&
      sessionStorage.getItem(${JSON.stringify(SESSION_KEY)}) === null) {
    document.documentElement.setAttribute(${JSON.stringify(PENDING_ATTRIBUTE)}, "");
  }
} catch {}`;

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

    const media = globalThis.matchMedia(DESKTOP_MOTION);
    // Retain eligibility during React's development effect replay.
    eligible.current ??= claimEntrance(media.matches, skip);
    if (!eligible.current || !media.matches) {
      document.documentElement.removeAttribute(PENDING_ATTRIBUTE);
      return;
    }

    const animations = animateEntrance(container, overlay);
    // The animation now owns the dot's opacity; remove the pre-hydration guard atomically.
    document.documentElement.removeAttribute(PENDING_ATTRIBUTE);
    const stop = (): void => {
      for (const animation of animations) animation.cancel();
    };
    // Finish immediately if the visitor starts using the form or changes viewport/preferences.
    container.addEventListener("focusin", stop);
    window.addEventListener("resize", stop);
    media.addEventListener("change", stop);
    void Promise.all(animations.map((animation) => animation.finished)).then(stop, stop);

    return () => {
      stop();
      container.removeEventListener("focusin", stop);
      window.removeEventListener("resize", stop);
      media.removeEventListener("change", stop);
    };
  }, [skip]);

  return (
    <main
      ref={root}
      className="dark relative grid min-h-svh bg-marquee font-body text-marquee-foreground lg:grid-cols-[minmax(0,1.1fr)_minmax(440px,0.9fr)]"
    >
      {!skip && <script dangerouslySetInnerHTML={{ __html: ENTRANCE_BOOTSTRAP }} />}
      {children}
      <svg ref={flight} className={styles.flight} aria-hidden="true" focusable="false">
        <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle r="1" fill="currentColor" />
      </svg>
    </main>
  );
}

function claimEntrance(desktopMotion: boolean, skip: boolean): boolean {
  try {
    const seen = sessionStorage.getItem(SESSION_KEY) !== null;
    sessionStorage.setItem(SESSION_KEY, "1");
    return !seen && desktopMotion && !skip;
  } catch {
    // Without session storage, keep the static screen instead of replaying on every visit.
    return false;
  }
}
