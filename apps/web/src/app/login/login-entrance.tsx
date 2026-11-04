"use client";

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";

import { BookLoader } from "@lazuli/ui";
import { waitForAnimationPreview } from "~/lib/animation-preview";
import { isDevelopment } from "~/lib/env";

import { waitForLoginAssets } from "./login-assets";
import { animateEntrance, dissolveLoader } from "./login-entrance-motion";
import { LoginLoadingCaption } from "./login-loading-caption";
import styles from "./login-entrance.module.css";
import transition from "./login-transition.module.css";

const SESSION_KEY = "lazuli:cinematic-entrance-seen";
const ENTRANCE_MOTION = "(prefers-reduced-motion: no-preference)";
const FULL_ENTRANCE_TIMEOUT_MS = 2800;
const REDUCED_ENTRANCE_TIMEOUT_MS = 300;
const LOGIN_PREVIEW_WAIT_MS = 1200;

export function LoginEntrance({
  children,
  skip,
}: {
  children: ReactNode;
  skip: boolean;
}): ReactNode {
  const root = useLoginEntrance(skip);
  return (
    <div ref={root} className={`dark ${transition.stage}`} data-phase="loading">
      <main className={styles.entrance} data-login-scene>
        <LoginBrand />
        {children}
      </main>
      <div className={transition.curtain} data-login-curtain>
        <div className={transition.loader} data-login-loader>
          <div data-login-book>
            <BookLoader label="Preparando seu acesso" />
          </div>
          <LoginLoadingCaption />
        </div>
      </div>
      <div className={transition.point} data-login-point aria-hidden="true" />
    </div>
  );
}

function useLoginEntrance(skip: boolean): RefObject<HTMLDivElement | null> {
  const root = useRef<HTMLDivElement>(null);
  const eligible = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    const container = root.current;
    if (container === null) return;
    eligible.current ??= claimEntrance(skip);
    return startEntrance(container, eligible.current);
  }, [skip]);
  return root;
}

function startEntrance(container: HTMLElement, eligible: boolean): () => void {
  const controller = new AbortController();
  const media = globalThis.matchMedia(ENTRANCE_MOTION);
  const images = [...container.querySelectorAll("img")];
  let animations: Animation[] = [];
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const finish = (): void => {
    if (container.dataset.phase === "ready") return;
    container.dataset.phase = "ready";
    if (deadline !== undefined) globalThis.clearTimeout(deadline);
    for (const animation of animations) animation.cancel();
    focusLoginField(container);
  };
  const reveal = (): void => {
    if (controller.signal.aborted || container.dataset.phase === "ready") return;
    if (!eligible) {
      finish();
      return;
    }
    container.dataset.phase = "opening";
    animations = media.matches ? animateEntrance(container) : dissolveLoader(container);
    deadline = globalThis.setTimeout(
      finish,
      media.matches ? FULL_ENTRANCE_TIMEOUT_MS : REDUCED_ENTRANCE_TIMEOUT_MS,
    );
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (!controller.signal.aborted) finish();
    });
  };
  container.dataset.phase = "loading";
  bindInterruptions(container, { signal: controller.signal, media, finish });
  void Promise.all([
    waitForLoginAssets(images, controller.signal),
    eligible
      ? waitForAnimationPreview(LOGIN_PREVIEW_WAIT_MS, controller.signal)
      : Promise.resolve(),
  ]).then(reveal, reveal);
  return () => {
    controller.abort();
    if (deadline !== undefined) globalThis.clearTimeout(deadline);
    for (const animation of animations) animation.cancel();
  };
}

function bindInterruptions(
  container: HTMLElement,
  options: {
    signal: AbortSignal;
    media: MediaQueryList;
    finish: () => void;
  },
): void {
  const { signal, media, finish } = options;
  const stopOnInteraction = (event: Event): void => {
    if (event.target instanceof Element && event.target.closest("[data-login-scene]")) finish();
  };
  container.addEventListener("focusin", stopOnInteraction, { signal });
  container.addEventListener("pointerdown", stopOnInteraction, { signal });
  media.addEventListener("change", finish, { signal });
  window.addEventListener(
    "resize",
    () => {
      if (container.dataset.phase === "opening") finish();
    },
    { signal },
  );
}

function claimEntrance(skip: boolean): boolean {
  if (isDevelopment) return !skip;
  try {
    const seen = sessionStorage.getItem(SESSION_KEY) !== null;
    sessionStorage.setItem(SESSION_KEY, "1");
    return !seen && !skip;
  } catch {
    return false;
  }
}

function focusLoginField(container: HTMLElement): void {
  const active = document.activeElement;
  const desktop = globalThis.matchMedia("(min-width: 981px)").matches;
  if (desktop && active === document.body) {
    container
      .querySelector<HTMLInputElement>("input[name='email']")
      ?.focus({ preventScroll: true });
  }
}

function LoginBrand(): ReactNode {
  return (
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
        <span className={styles.wordmark} data-login-reveal="wordmark">
          <img src="/brand/lazuli-wordmark-dark.svg" alt="" width="320" height="100" />
          <svg
            aria-hidden="true"
            viewBox="0 0 10 10"
            className={styles.brandDot}
            data-login-destination
          >
            <circle cx="5" cy="5" r="5" fill="currentColor" />
          </svg>
        </span>
      </p>
    </header>
  );
}
