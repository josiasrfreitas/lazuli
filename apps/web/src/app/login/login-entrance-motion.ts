const FLIGHT_TIMING: KeyframeAnimationOptions = { duration: 1800, fill: "both" };
const FLIGHT_EASING = "cubic-bezier(0.77, 0, 0.175, 1)";
const REVEAL_EASING = "cubic-bezier(0.23, 1, 0.32, 1)";
const POINT_SAMPLES = 100;
const POINT_SWELL = 0.8;
const POINT_FADE_RATE = 12;
const TRAIL_MAX_LENGTH = 150;
const TRAIL_PATH_RATIO = 0.16;

// Coordinates describe the sweep above the headline, the upward arc, and the landing curl.
const CURVE = {
  captionInset: 24,
  start: { width: 0.12, belowCaption: 28 },
  sweep: { width: 0.23, aboveCaption: 100 },
  turn: { width: 0.58, belowCaption: 36 },
  rise: { width: 0.69, height: 0.43 },
  crest: { width: 0.83, height: 0.08 },
  approach: { right: 80, above: 32 },
  curl: { right: 20, above: 12 },
  rebound: { left: 12, below: 18 },
  settle: { left: 5, above: 10 },
};

/** Measure the rendered composition so the point lands on the actual brand punctuation. */
export function animateEntrance(root: HTMLElement, overlay: SVGSVGElement): Animation[] {
  const bounds = root.getBoundingClientRect();
  if (bounds.width <= 980 || bounds.height <= 540) return animateContent(root);

  const hero = root.querySelector<HTMLElement>("[data-login-hero]");
  const destination = root.querySelector<SVGCircleElement>("[data-brand-dot]");
  const path = overlay.querySelector("path");
  const point = overlay.querySelector("circle");
  const caption = root.querySelector<HTMLElement>("[data-login-caption]");
  if (
    hero === null ||
    destination === null ||
    path === null ||
    point === null ||
    caption === null
  ) {
    return [];
  }

  const target = destination.getBoundingClientRect();
  overlay.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
  point.setAttribute("r", String(target.width / 2));
  path.setAttribute(
    "d",
    flightPath({
      panel: bounds,
      target,
      captionTop: caption.getBoundingClientRect().top,
    }),
  );
  return [
    overlay.animate([{ opacity: 1 }, { opacity: 1 }], FLIGHT_TIMING),
    destination.animate([{ opacity: 0 }, { opacity: 0 }], FLIGHT_TIMING),
    ...animateFlight(path, point),
    ...animateContent(root),
  ];
}

function flightPath({
  panel,
  target,
  captionTop,
}: {
  panel: DOMRect;
  target: DOMRect;
  captionTop: number;
}): string {
  const targetX = target.left + target.width / 2 - panel.left;
  const targetY = target.top + target.height / 2 - panel.top;
  const captionY = captionTop - panel.top - CURVE.captionInset;
  const { width, height } = panel;
  return [
    `M ${width * CURVE.start.width} ${captionY + CURVE.start.belowCaption}`,
    `C ${width * CURVE.sweep.width} ${captionY - CURVE.sweep.aboveCaption}, ${width * CURVE.turn.width} ${captionY + CURVE.turn.belowCaption}, ${width * CURVE.rise.width} ${height * CURVE.rise.height}`,
    `C ${width * CURVE.crest.width} ${height * CURVE.crest.height}, ${targetX + CURVE.approach.right} ${targetY - CURVE.approach.above}, ${targetX + CURVE.curl.right} ${targetY - CURVE.curl.above}`,
    `C ${targetX - CURVE.rebound.left} ${targetY + CURVE.rebound.below}, ${targetX - CURVE.settle.left} ${targetY - CURVE.settle.above}, ${targetX} ${targetY}`,
  ].join(" ");
}

function pointFrames(path: SVGPathElement): Keyframe[] {
  const length = path.getTotalLength();
  return Array.from({ length: POINT_SAMPLES + 1 }, (_value, index) => {
    const progress = index / POINT_SAMPLES;
    const position = path.getPointAtLength(length * progress);
    const scale = 1 + POINT_SWELL * Math.sin(Math.PI * progress);
    return {
      offset: progress,
      transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
      opacity: Math.min(1, progress * POINT_FADE_RATE),
    };
  });
}

function animateFlight(path: SVGPathElement, point: SVGCircleElement): Animation[] {
  const length = path.getTotalLength();
  const trail = Math.min(TRAIL_MAX_LENGTH, length * TRAIL_PATH_RATIO);
  path.setAttribute("stroke-dasharray", `${trail} ${length}`);
  return [
    point.animate(pointFrames(path), { ...FLIGHT_TIMING, easing: FLIGHT_EASING }),
    path.animate([{ strokeDashoffset: `${trail}` }, { strokeDashoffset: `${trail - length}` }], {
      ...FLIGHT_TIMING,
      easing: FLIGHT_EASING,
    }),
    path.animate(
      [
        { opacity: 0, offset: 0 },
        { opacity: 0.6, offset: 0.18 },
        { opacity: 0.4, offset: 0.65 },
        { opacity: 0, offset: 0.92 },
        { opacity: 0, offset: 1 },
      ],
      FLIGHT_TIMING,
    ),
  ];
}

function animateContent(root: HTMLElement): Animation[] {
  const animations: Animation[] = [];
  const photo = root.querySelector("[data-login-photo]");
  if (photo !== null) {
    animations.push(
      photo.animate(
        [
          { opacity: 0.45, transform: "scale(1.12)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        { duration: 2400, fill: "both", easing: REVEAL_EASING },
      ),
    );
  }
  const reveals = [
    { name: "seal", delay: 0, duration: 1000, from: "scale(0.9) rotate(-12deg)" },
    { name: "wordmark", delay: 80, duration: 1100, from: "translateX(-18px)" },
    { name: "line-one", delay: 160, duration: 1100, from: "translateY(105%)" },
    { name: "line-two", delay: 240, duration: 1100, from: "translateY(105%)" },
    { name: "description", delay: 320, duration: 900, from: "translateY(12px)" },
    { name: "panel", delay: 0, duration: 280, from: "none" },
    { name: "form", delay: 0, duration: 280, from: "translateY(8px)" },
  ];
  for (const { name, delay, duration, from } of reveals) {
    const element = root.querySelector(`[data-login-reveal="${name}"]`);
    if (element !== null) {
      animations.push(
        element.animate(
          [
            { opacity: name.startsWith("line-") || name === "panel" ? 1 : 0, transform: from },
            { opacity: 1, transform: "none" },
          ],
          { duration, delay, fill: "both", easing: REVEAL_EASING },
        ),
      );
    }
  }
  return animations;
}
