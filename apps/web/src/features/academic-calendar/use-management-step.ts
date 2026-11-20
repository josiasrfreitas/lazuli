"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

type ManagementStep<T> = {
  step: T;
  setStep: (next: T) => void;
  container: RefObject<HTMLDivElement | null>;
  onPointerDown: () => void;
  onKeyDown: () => void;
};

const MILLISECONDS_PER_SECOND = 1000;

function duration(tokens: CSSStyleDeclaration, property: string): number {
  const value = tokens.getPropertyValue(property).trim();
  return Number.parseFloat(value) * (value.endsWith("ms") ? 1 : MILLISECONDS_PER_SECOND);
}

/** Keep the current stage mounted until its exit completes; keyboard navigation stays instant. */
export function useManagementStep<T>(initial: T): ManagementStep<T> {
  const [step, setCurrentStep] = useState(initial);
  const container = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const pointer = useRef(false);
  const direction = useRef(1);
  const revision = useRef(0);

  useEffect(() => () => animation.current?.cancel(), []);

  useLayoutEffect(() => {
    const element = container.current;
    animation.current?.cancel();
    if (!element || !pointer.current) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tokens = getComputedStyle(element);
    const entry = element.animate(
      [
        { opacity: 0, transform: reduced ? "none" : `translateX(${direction.current}%)` },
        { opacity: 1, transform: "none" },
      ],
      {
        duration: duration(tokens, reduced ? "--lz-duration-fast" : "--lz-duration-base"),
        easing: tokens.getPropertyValue("--lz-ease-standard").trim(),
      },
    );
    animation.current = entry;
    return () => entry.cancel();
  }, [step]);

  function setStep(next: T): void {
    const element = container.current;
    const currentRevision = ++revision.current;
    direction.current = next === initial ? -1 : 1;
    if (!element || !pointer.current) {
      animation.current?.cancel();
      setCurrentStep(next);
      return;
    }
    const tokens = getComputedStyle(element);
    const start = { opacity: tokens.opacity, transform: tokens.transform };
    animation.current?.cancel();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const exit = element.animate(
      [start, { opacity: 0, transform: reduced ? "none" : `translateX(${-direction.current}%)` }],
      {
        duration: duration(tokens, "--lz-duration-fast"),
        easing: tokens.getPropertyValue("--lz-ease-standard").trim(),
        fill: "forwards",
      },
    );
    animation.current = exit;
    void exit.finished
      .then(() => {
        if (currentRevision === revision.current && element.isConnected) setCurrentStep(next);
      })
      .catch(() => {});
  }

  return {
    step,
    setStep,
    container,
    onPointerDown: () => {
      pointer.current = true;
    },
    onKeyDown: () => {
      pointer.current = false;
    },
  };
}
