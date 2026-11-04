function installClientProbe({ label, selector }) {
  globalThis.__lazuliClientProbe?.disconnect();
  const startedAt = performance.now();
  const focusedAtArm = document.hasFocus();
  let focusedAtInput;
  let interrupted = false;
  const interrupt = () => {
    if (interactionAt !== undefined && readyAt === undefined) interrupted = true;
  };
  const records = { longTasks: [], events: [], frames: [] };
  const observers = [];
  const observe = (type, target, project, options = {}) => {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) return;
    const observer = new PerformanceObserver((list) => {
      target.push(...list.getEntries().map(project));
    });
    observer.observe({ type, ...options });
    observers.push(observer);
  };
  observe("longtask", records.longTasks, ({ startTime, duration }) => ({ startTime, duration }));
  observe(
    "event",
    records.events,
    ({ name, duration, interactionId, processingStart, processingEnd, startTime }) => ({
      name,
      startTime,
      duration,
      interactionId,
      inputDelay: processingStart - startTime,
      processing: processingEnd - processingStart,
    }),
    { durationThreshold: 16 },
  );
  observe("long-animation-frame", records.frames, ({ duration, blockingDuration, scripts }) => ({
    duration,
    blockingDuration,
    scripts: scripts.map(({ sourceURL, sourceFunctionName, duration: scriptDuration }) => ({
      source: sourceURL?.split("?")[0],
      function: sourceFunctionName,
      duration: scriptDuration,
    })),
  }));
  let interactionAt;
  let readyAt;
  let frame;
  const check = () => {
    if (interactionAt === undefined) return;
    const target = document.querySelector(selector);
    if (target && target.getAttribute("aria-busy") !== "true") {
      frame = requestAnimationFrame(() => {
        readyAt = performance.now();
      });
    } else frame = requestAnimationFrame(check);
  };
  const begin = (event) => {
    interactionAt = event.timeStamp;
    focusedAtInput = document.hasFocus();
    check();
  };
  document.addEventListener("pointerdown", begin, { once: true, capture: true });
  window.addEventListener("blur", interrupt);
  document.addEventListener("visibilitychange", interrupt);
  const disconnect = () => {
    observers.forEach((observer) => observer.disconnect());
    window.removeEventListener("blur", interrupt);
    document.removeEventListener("visibilitychange", interrupt);
    document.removeEventListener("pointerdown", begin, { capture: true });
    cancelAnimationFrame(frame);
  };
  globalThis.__lazuliClientProbe = {
    disconnect,
    read: () => ({
      label,
      browser: navigator.userAgent,
      visibility: document.visibilityState,
      hasFocus: document.hasFocus(),
      focusedAtArm,
      focusedAtInput,
      interrupted,
      validForLatency:
        Number.isFinite(readyAt) &&
        Number.isFinite(interactionAt) &&
        readyAt >= interactionAt &&
        !interrupted &&
        focusedAtArm &&
        focusedAtInput &&
        document.hasFocus() &&
        document.visibilityState === "visible",
      elapsedMs: performance.now() - startedAt,
      interactionAt,
      readyAt,
      readinessSelector: selector,
      readyAfterInputMs:
        readyAt !== undefined && interactionAt !== undefined ? readyAt - interactionAt : null,
      // This controlled sample is not field INP or Lighthouse TBT.
      maxObservedEventMs: Math.max(
        0,
        ...records.events.filter((event) => event.interactionId).map((event) => event.duration),
      ),
      observedLongTaskBlockingMs: records.longTasks.reduce(
        (sum, task) => sum + Math.max(0, task.duration - 50),
        0,
      ),
      interactionLongTaskBlockingMs:
        interactionAt === undefined || readyAt === undefined
          ? null
          : records.longTasks.reduce(
              (sum, task) =>
                sum +
                Math.max(
                  0,
                  Math.min(readyAt, task.startTime + task.duration) -
                    Math.max(interactionAt, task.startTime + 50),
                ),
              0,
            ),
      ...records,
      scripts: performance
        .getEntriesByType("resource")
        .filter(
          (resource) => resource.startTime >= startedAt && /\.(js|mjs)(\?|$)/u.test(resource.name),
        )
        .map(({ name, transferSize, encodedBodySize, decodedBodySize, duration }) => ({
          path: new URL(name).pathname,
          transferSize,
          encodedBodySize,
          decodedBodySize,
          duration,
        })),
    }),
  };
  return JSON.stringify({ armed: true, label, supported: PerformanceObserver.supportedEntryTypes });
}
