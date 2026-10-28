const ARRIVAL_DURATION = 760;
const DISSOLVE_DURATION = 160;
const WORDMARK_DURATION = 240;
const COVER_DURATION = 600;
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

type Animate = (
  element: Element | null,
  options: { frames: Keyframe[]; duration: number },
) => Animation | undefined;

function trackedAnimator(animations: Animation[]): Animate {
  return (element, { frames, duration }) => {
    const animation = element?.animate(frames, { duration, easing: EASE_OUT, fill: "both" });
    if (animation) animations.push(animation);
    return animation;
  };
}

function revealHome(root: HTMLElement, animate: Animate): void {
  animate(root.querySelector("[data-arrival-wordmark]"), {
    frames: [{ opacity: 1 }, { opacity: 0 }],
    duration: WORDMARK_DURATION,
  });
  animate(root.querySelector("[data-arrival-cover]"), {
    frames: [{ opacity: 1 }, { opacity: 0 }],
    duration: COVER_DURATION,
  });
  animate(document.querySelector("[data-home-content]"), {
    frames: [
      { opacity: 0.35, transform: "translateY(8px)" },
      { opacity: 1, transform: "none" },
    ],
    duration: ARRIVAL_DURATION,
  });
}

function travelBrand(root: HTMLElement, animate: Animate): Animation | undefined {
  const target = document.querySelector<HTMLElement>(
    '[data-slot="app-sidebar"] [data-brand-symbol]',
  );
  const symbol = root.querySelector<HTMLElement>("[data-arrival-symbol]");
  const destination = target?.getBoundingClientRect();
  const origin = symbol?.getBoundingClientRect();
  if (!destination?.width || !origin?.width) return undefined;
  const transform = `translate(${destination.x - origin.x}px, ${destination.y - origin.y}px) scale(${destination.width / origin.width})`;
  animate(target, {
    frames: [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.8 }, { opacity: 1 }],
    duration: ARRIVAL_DURATION,
  });
  revealHome(root, animate);
  return animate(symbol, {
    frames: [
      { transform: "none", opacity: 1, offset: 0 },
      { transform, opacity: 1, offset: 0.8 },
      { transform, opacity: 0, offset: 1 },
    ],
    duration: ARRIVAL_DURATION,
  });
}

/** A single interruptible handoff. No animation owns focus, scrolling or input. */
export function playHomeArrival(root: HTMLElement): () => void {
  const animations: Animation[] = [];
  const events = new AbortController();
  const preference = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  let finished = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    if (deadline !== undefined) globalThis.clearTimeout(deadline);
    root.hidden = true;
    for (const animation of animations) animation.cancel();
    events.abort();
  };
  // Strict Mode may have just cleaned up an earlier run. Late hydration must
  // respect the CSS deadline instead of covering the application again.
  root.hidden = false;
  if (getComputedStyle(root).visibility === "hidden" || typeof root.animate !== "function") {
    finish();
    return finish;
  }
  const animate = trackedAnimator(animations);
  const travel = preference.matches ? undefined : travelBrand(root, animate);
  const completion =
    travel ??
    animate(root, {
      frames: [{ opacity: 1 }, { opacity: 0 }],
      duration: DISSOLVE_DURATION,
    });
  // Resizing invalidates the destination; any interaction takes priority.
  for (const name of ["pointerdown", "keydown", "resize", "pagehide"]) {
    globalThis.addEventListener(name, finish, { once: true, signal: events.signal });
  }
  preference.addEventListener("change", finish, { once: true, signal: events.signal });
  deadline = globalThis.setTimeout(finish, preference.matches ? 200 : 1400);
  if (completion) void completion.finished.then(finish, finish);
  else finish();
  return finish;
}
