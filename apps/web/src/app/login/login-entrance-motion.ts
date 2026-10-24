const REVEAL_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const FLIGHT_EASING = "cubic-bezier(0.45, 0, 0.2, 1)";
const POINT_SIZE = 12;
const FLIGHT_SAMPLES = 60;
const DEPARTURE_SWEEP = 0.18;
const ARRIVAL_SWEEP = 0.2;
const POINT_FADE_RATE = 30;
const FLIGHT_DELAY = 520;
const FLIGHT_DURATION = 1600;

type MotionCue = {
  selector: string;
  frames: Keyframe[];
  duration: number;
  delay?: number;
  easing?: string;
};

/** Close the book into a gold point, then carry it into the brand punctuation. */
export function animateEntrance(root: HTMLElement): Animation[] {
  const book = root.querySelector("[data-login-book]");
  const destination = root.querySelector("[data-login-destination]");
  if (book === null || destination === null) return dissolveLoader(root);
  const bounds = root.getBoundingClientRect();
  const origin = book.getBoundingClientRect();
  const target = destination.getBoundingClientRect();
  if (target.width === 0) return dissolveLoader(root);
  const journey = flightFrames({ bounds, origin, target });
  return playCues(root, [
    ...closeBookCues(),
    {
      selector: "[data-login-point]",
      frames: journey,
      duration: FLIGHT_DURATION,
      delay: FLIGHT_DELAY,
      easing: FLIGHT_EASING,
    },
    {
      selector: "[data-login-destination]",
      frames: [{ opacity: 0 }, { opacity: 0 }],
      duration: FLIGHT_DELAY + FLIGHT_DURATION,
    },
    ...contentCues(),
  ]);
}

/** Return visits and reduced motion retain only the state-change dissolve. */
export function dissolveLoader(root: HTMLElement): Animation[] {
  return playCues(root, [
    {
      selector: "[data-login-curtain]",
      frames: [{ opacity: 1 }, { opacity: 0 }],
      duration: 180,
    },
  ]);
}

function closeBookCues(): MotionCue[] {
  return [
    {
      selector: "[data-login-book]",
      frames: [
        { transform: "perspective(600px) rotateY(0deg) scale(1)", opacity: 1 },
        { transform: "perspective(600px) rotateY(72deg) scale(0.65)", opacity: 1, offset: 0.65 },
        { transform: "perspective(600px) rotateY(90deg) scale(0.12)", opacity: 0 },
      ],
      duration: FLIGHT_DELAY,
      easing: FLIGHT_EASING,
    },
    {
      selector: "[data-login-curtain]",
      frames: [{ opacity: 1 }, { opacity: 0 }],
      duration: 700,
      delay: 460,
    },
    {
      selector: "[data-login-caption-loading]",
      frames: [{ opacity: 1 }, { opacity: 0 }],
      duration: 200,
    },
  ];
}

type Point = { left: number; top: number };

function flightFrames({
  bounds,
  origin,
  target,
}: {
  bounds: DOMRect;
  origin: DOMRect;
  target: DOMRect;
}): Keyframe[] {
  const start = {
    left: origin.left + origin.width / 2 - bounds.left,
    top: origin.top + origin.height / 2 - bounds.top,
  };
  const end = {
    left: target.left + target.width / 2 - bounds.left,
    top: target.top + target.height / 2 - bounds.top,
  };
  const curve = [
    start,
    {
      left: Math.min(bounds.width - POINT_SIZE, start.left + bounds.width * DEPARTURE_SWEEP),
      top: start.top,
    },
    {
      left: Math.min(bounds.width - POINT_SIZE, end.left + bounds.width * ARRIVAL_SWEEP),
      top: end.top,
    },
    end,
  ];
  return Array.from({ length: FLIGHT_SAMPLES + 1 }, (_value, index) => {
    const progress = index / FLIGHT_SAMPLES;
    const position = bezierPoint(curve, progress);
    const scale = 1 + (target.width / POINT_SIZE - 1) * progress;
    return {
      offset: progress,
      opacity: Math.min(1, progress * POINT_FADE_RATE),
      transform: `translate(${position.left - POINT_SIZE / 2}px, ${position.top - POINT_SIZE / 2}px) scale(${scale})`,
    };
  });
}

function bezierPoint(points: Point[], progress: number): Point {
  // De Casteljau interpolation keeps the measured endpoints exact at every viewport.
  let level = points;
  while (level.length > 1) {
    level = level.slice(0, -1).map((point, index) => {
      const next = level[index + 1] ?? point;
      return {
        left: point.left + (next.left - point.left) * progress,
        top: point.top + (next.top - point.top) * progress,
      };
    });
  }
  return level[0] ?? { left: 0, top: 0 };
}

function contentCues(): MotionCue[] {
  const reveals = [
    { name: "seal", delay: 500, from: "none" },
    { name: "wordmark", delay: 600, from: "none" },
    { name: "line-one", delay: 860, from: "translateY(105%) rotate(2deg)" },
    { name: "line-two", delay: 980, from: "translateY(105%) rotate(2deg)" },
    { name: "description", delay: 1080, from: "translateY(12px)" },
    { name: "panel", delay: 880, from: "perspective(1200px) rotateY(-12deg) translateX(32px)" },
    { name: "form", delay: 1040, from: "translateY(16px)" },
  ];
  return [
    {
      selector: "[data-login-photo]",
      frames: [{ transform: "scale(1.08)" }, { transform: "scale(1)" }],
      duration: 1800,
      delay: 400,
    },
    ...reveals.map(({ name, delay, from }) => ({
      selector: `[data-login-reveal="${name}"]`,
      frames: [
        { opacity: 0, transform: from },
        { opacity: 1, transform: "none" },
      ],
      duration: 720,
      delay,
    })),
  ];
}

function playCues(root: HTMLElement, cues: MotionCue[]): Animation[] {
  const animations: Animation[] = [];
  try {
    for (const { selector, frames, ...timing } of cues) {
      const element = root.querySelector(selector);
      if (element !== null) {
        animations.push(
          element.animate(frames, { fill: "both", easing: REVEAL_EASING, ...timing }),
        );
      }
    }
    return animations;
  } catch {
    // A partial animation must never leave content hidden or block access.
    for (const animation of animations) animation.cancel();
    return [];
  }
}
