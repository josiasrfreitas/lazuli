function round(value) {
  return Math.round(value * 100) / 100;
}

function slot(name, root = globalThis.document) {
  return root.querySelector(`[data-slot="${name}"]`);
}

function box(element) {
  const { top, bottom, left, right, width, height } = element.getBoundingClientRect();
  return { top, bottom, left, right, width, height };
}

function frame() {
  // Orca can evaluate an inactive tab, where Chromium may suspend paint callbacks.
  return new Promise((resolve) => {
    const raf = globalThis.requestAnimationFrame(() => {
      globalThis.clearTimeout(fallback);
      resolve();
    });
    const fallback = globalThis.setTimeout(() => {
      globalThis.cancelAnimationFrame(raf);
      resolve();
    }, 50);
  });
}

async function wait(description, read) {
  const deadline = globalThis.performance.now() + 8000;
  while (globalThis.performance.now() < deadline) {
    const value = read();
    if (value) return value;
    await frame();
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function stable(element) {
  await globalThis.document.fonts.ready;
  let previous;
  let equalFrames = 0;
  await wait("stable layout", () => {
    const current = JSON.stringify(box(element));
    equalFrames = current === previous ? equalFrames + 1 : 0;
    previous = current;
    return equalFrames >= 3;
  });
}

function button(label, root = globalThis.document) {
  return [...root.querySelectorAll("button")].find(
    (element) => element.textContent.trim() === label,
  );
}

async function prepareList({ empty }) {
  const page = await wait("Alunos", () => {
    const element = slot("data-table-page");
    return element?.querySelector("h1")?.textContent === "Alunos" && element;
  });
  const viewport = await wait("table viewport", () => slot("table-viewport", page));
  const anchor = await wait(
    empty ? "filtered empty message" : "first populated student row",
    () => {
      if (!empty) return page.querySelector('tbody tr[data-slot=table-row][tabindex="0"]');
      const title = slot("empty-state-title", page);
      return title?.textContent === "Nenhum aluno encontrado" && title;
    },
  );
  globalThis.scrollTo(0, 0);
  viewport.scrollTo(0, 0);
  await stable(anchor);
  if (
    [globalThis.scrollX, globalThis.scrollY, viewport.scrollTop, viewport.scrollLeft].some(Boolean)
  ) {
    throw new Error("Window or table scroll is nonzero");
  }
  return { page, anchor };
}

function inspectList({ page, anchor }, { empty, width, height, limits }, verify) {
  const toolbar = box(slot("data-table-page-toolbar", page));
  const heading = box(slot("data-table-page-header", page));
  const content = box(slot("data-table-page-content", page));
  const origin = box(page).top;
  const anchorY = box(anchor).top;
  const populatedMax = width <= 480 ? limits.listNarrow : limits.listWide;
  const max = empty ? limits.empty : populatedMax;
  const observed = {
    anchorY,
    percentOfViewport: round((anchorY / height) * 100),
    contentOrigin: origin,
    toolbarHeight: toolbar.height,
    titleHeight: heading.height,
    tableY: content.top,
    tableSpace: content.top - toolbar.bottom,
  };
  verify(
    empty ? "empty-position" : "first-row-position",
    "Alunos / DataTablePage",
    { maxViewportTop: max, minViewportTop: origin },
    observed,
    anchorY <= max && anchorY >= origin,
  );
  return observed;
}

async function locationOptions(form, count) {
  const location = [...form.querySelectorAll("label")]
    .find((label) => label.textContent === "Local de atendimento")
    .closest('[data-slot="field"]');
  const segmented = slot("segmented-control", location);
  const select = slot("select-trigger", location);
  if (Boolean(segmented) === Boolean(select))
    throw new Error("Expected one operable location field");
  if (select) select.click();
  const options = await wait(`${count} location options`, () => {
    const elements = [
      ...(segmented ?? globalThis.document).querySelectorAll(
        segmented
          ? '[data-slot="segmented-control-item"]'
          : '[data-slot="select-item"][role="option"]',
      ),
    ];
    return elements.length === count && elements;
  });
  return { location, segmented, select, options };
}

async function submitInvalid(dialog, form, options) {
  options.find((item) => item.textContent.trim() === "Outro local").click();
  await wait("required alternate address", () => form.querySelector('[name="address"]:required'));
  button("Salvar", dialog).click();
  await wait("validation error", () => {
    const element = slot("field-error", form);
    return element?.getBoundingClientRect().height > 0 && element;
  });
}

async function prepareModal({ count, runtime, invalid }) {
  const open = await wait("Novo atendimento trigger", () => button("Novo atendimento"));
  open.click();
  const dialog = await wait("open dialog", () => slot("dialog-content"));
  const form = dialog.querySelector("form");
  const initialOptionsState = form.dataset.optionsState;
  const initialSegmentCount = form.querySelectorAll('[data-slot="segmented-control-item"]').length;
  if (runtime && initialSegmentCount > 0 && initialSegmentCount !== 2) {
    throw new Error("Expected two segments before asynchronous options arrive");
  }
  if (runtime && initialOptionsState !== "loading") {
    throw new Error("Runtime options must first be captured in loading state");
  }
  await wait("options ready", () => form.dataset.optionsState === "ready");
  await stable(dialog);
  const initialFocus = globalThis.document.activeElement?.name;
  const choices = await locationOptions(form, count);
  if (invalid) await submitInvalid(dialog, form, choices.options);
  else if (choices.select) choices.options[0].click();
  await stable(dialog);
  return { dialog, form, choices, initialOptionsState, initialSegmentCount, initialFocus };
}

function fitsHorizontally(item, boundary, tolerance) {
  return item.left >= boundary.left - tolerance && item.right <= boundary.right + tolerance;
}

function widePairFits({ city, state, distance, gap }, limits) {
  return (
    distance <= limits.tolerance &&
    city.width >= limits.cityMin &&
    state.width >= limits.stateMin &&
    state.width <= limits.stateMax &&
    Math.abs(gap - limits.pairGap) <= limits.tolerance
  );
}

function stackedPairFits({ city, state, pair }, tolerance) {
  return (
    state.top >= city.bottom &&
    Math.abs(city.right - pair.right) <= tolerance &&
    Math.abs(state.left - pair.left) <= tolerance
  );
}

function inspectPair({ dialog, form }, limits, verify) {
  const cityControl = form.querySelector('input[name="city"]');
  const pair = box(cityControl.closest('[data-slot="form-row"]'));
  const city = box(cityControl);
  const state = box(form.querySelector('input[name="state"]'));
  const { tolerance } = limits;
  const wide = pair.width >= limits.pairBreakpoint;
  const distance = Math.abs(city.top - state.top);
  const gap = state.left - city.right;
  const pairMetrics = {
    dialogWidth: box(dialog).width,
    groupWidth: pair.width,
    cityWidth: city.width,
    stateWidth: state.width,
    verticalDistance: distance,
    horizontalGap: gap,
    wide,
  };
  const inside = [city, state].every((control) => fitsHorizontally(control, pair, tolerance));
  const aligned = Math.abs(city.left - pair.left) <= tolerance;
  const fills = Math.abs(state.right - pair.right) <= tolerance;
  const dimensions = { city, state, pair, distance, gap };
  const fits = wide ? widePairFits(dimensions, limits) : stackedPairFits(dimensions, tolerance);
  const expected = wide
    ? {
        sameRow: true,
        cityMin: limits.cityMin,
        stateMin: limits.stateMin,
        stateMax: limits.stateMax,
        gap: limits.pairGap,
        fills: true,
      }
    : { sameRow: false, stacked: true, bothFullWidth: true };
  verify(
    "field-pair",
    "Novo atendimento / Cidade e UF",
    expected,
    pairMetrics,
    inside && aligned && fills && fits,
  );
  return pairMetrics;
}

function inspectSegments({ location, segmented, options }, tolerance) {
  const optionBoxes = options.map((option) => box(option));
  const field = box(location);
  const section = box(location.closest('[data-slot="form-section"]'));
  const boundary = {
    left: Math.max(field.left, section.left),
    right: Math.min(field.right, section.right),
  };
  const clipped = options.flatMap((item, index) => {
    const range = globalThis.document.createRange();
    range.selectNodeContents(item);
    return fitsHorizontally(range.getBoundingClientRect(), optionBoxes.at(index), tolerance)
      ? []
      : [item.textContent];
  });
  const oneRow = optionBoxes.every((item) => Math.abs(item.top - optionBoxes[0].top) <= tolerance);
  const insideField = [box(segmented), ...optionBoxes].every((item) =>
    fitsHorizontally(item, boundary, tolerance),
  );
  return { oneRow, clipped, insideField, fieldWidth: field.width, sectionWidth: section.width };
}

function inspectChoice({ choices, initialOptionsState, initialSegmentCount }, limits, verify) {
  const { segmented, options } = choices;
  const option = {
    kind: segmented ? "segmented" : "dropdown",
    count: options.length,
    initialOptionsState,
    initialSegmentCount,
  };
  if (!segmented) return option;

  const geometry = inspectSegments(choices, limits.tolerance);
  const observed = { ...option, ...geometry };
  verify(
    "single-choice",
    "Novo atendimento / Local de atendimento",
    { dropdownAt: limits.dropdownAt, oneRow: true, clippedLabels: 0, insideField: true },
    observed,
    options.length < limits.dropdownAt &&
      geometry.oneRow &&
      geometry.insideField &&
      geometry.clipped.length === 0,
  );
  return observed;
}

function inspectModal(state, { limits, invalid }, verify) {
  const pair = inspectPair(state, limits, verify);
  const option = inspectChoice(state, limits, verify);
  const contact = state.form.querySelector('input[name="contact"]');
  const controlWidth = box(contact).width;
  const groupWidth = box(contact.closest('[data-slot="form-section"]')).width;
  verify(
    "long-field",
    "Novo atendimento / Nome do responsável",
    { maxWidthDifference: limits.tolerance },
    { controlWidth, groupWidth },
    Math.abs(controlWidth - groupWidth) <= limits.tolerance,
  );
  const error = slot("field-error", state.form);
  const errorLines = error
    ? round(box(error).height / Number.parseFloat(globalThis.getComputedStyle(error).lineHeight))
    : null;
  if (invalid && !(errorLines >= 2))
    throw new Error(`Expected a multiline error control, measured ${errorLines} lines`);
  const errorFocus = invalid ? globalThis.document.activeElement?.name : null;
  return { ...pair, option, initialFocus: state.initialFocus, errorLines, errorFocus };
}

function readViewport({ width, height }) {
  const { innerWidth, innerHeight, devicePixelRatio, visualViewport } = globalThis;
  const actual = [innerWidth, innerHeight, devicePixelRatio, visualViewport.scale];
  if (actual.join("/") !== [width, height, 1, 1].join("/")) {
    throw new Error(`Unexpected width/height/DPR/zoom: ${actual.join("/")}`);
  }
  return actual;
}

async function exercise(scenario) {
  try {
    const viewport = readViewport(scenario);
    const failures = [];
    const verify = (id, component, expected, observed, passes) => {
      if (!passes) failures.push({ id, component, expected, observed });
    };
    const started = globalThis.performance.now();
    const list = scenario.surface === "list";
    const state = await (list ? prepareList(scenario) : prepareModal(scenario));
    const setupMs = round(globalThis.performance.now() - started);
    const inspect = list ? inspectList : inspectModal;
    const checkStart = globalThis.performance.now();
    const metrics = scenario.enabled ? inspect(state, scenario, verify) : null;
    const checkMs = scenario.enabled ? round(globalThis.performance.now() - checkStart) : 0;
    return { viewport, setupMs, checkMs, failures, metrics };
  } catch (error) {
    return { executionError: error.message };
  }
}

// Serialize the shared browser and detector functions into the Orca page context.
const functions = [
  round,
  slot,
  box,
  frame,
  wait,
  stable,
  button,
  prepareList,
  inspectList,
  locationOptions,
  submitInvalid,
  prepareModal,
  fitsHorizontally,
  widePairFits,
  stackedPairFits,
  inspectPair,
  inspectSegments,
  inspectChoice,
  inspectModal,
  readViewport,
  exercise,
]
  .map((fn) => fn.toString())
  .join("\n");

export function browserExpression(scenario) {
  return `(() => { ${functions}\n return exercise(${JSON.stringify(scenario)}); })()`;
}
