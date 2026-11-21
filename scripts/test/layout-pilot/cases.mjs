const list = (width, height, empty = false) => ({ surface: "list", width, height, empty });
const modal = (story, count, options = {}) => ({
  surface: "modal",
  story,
  count,
  width: 1280,
  height: 800,
  ...options,
});

export const controls = {
  desktop: list(1280, 800),
  mobile: list(390, 800),
  empty: list(1280, 800, true),
  modal: modal("reference", 5),
  "modal-mobile": modal("reference", 5, { width: 390 }),
  "modal-narrow": modal("narrow", 5),
  "runtime-six": modal("runtime-options", 6, { runtime: true }),
  "two-short": modal("short-options", 2),
  "two-long": modal("long-options", 2),
  "multiline-error": modal("narrow", 5, { invalid: true }),
  "held-viewport": list(1100, 760),
  "semantic-control": modal("reference", 5, { invalid: true }),
};

export const limits = {
  listWide: 240,
  listNarrow: 380,
  empty: 325,
  dropdownAt: 4,
  pairBreakpoint: 320,
  cityMin: 228,
  stateMin: 76,
  stateMax: 84,
  pairGap: 12,
  tolerance: 2,
};

const table = "packages/ui/src/components/data-table-page.tsx";
const story = "apps/storybook/src/patterns/layout-quality-pilot.stories.tsx";

export const mutations = {
  H1: {
    control: "desktop",
    expected: "first-row-position",
    file: table,
    from: '        data-slot="data-table-page-toolbar"',
    to: '        style={title === "Alunos" ? { paddingTop: 240 } : undefined}\n        data-slot="data-table-page-toolbar"',
  },
  H2: {
    control: "desktop",
    expected: "first-row-position",
    file: table,
    from: '<div className="min-h-0 flex-1" data-slot="data-table-page-content">',
    to: '<div className="min-h-0 flex-1" style={title === "Alunos" ? { marginTop: 240 } : undefined} data-slot="data-table-page-content">',
  },
  C1: {
    control: "modal",
    expected: "single-choice",
    file: story,
    from: 'const segmented = mode === "short";',
    to: 'const segmented = mode === "short" || mode === "five";',
  },
  C2: {
    control: "runtime-six",
    expected: "single-choice",
    file: story,
    from: 'const segmented = mode === "short";',
    to: 'const segmented = mode === "short" || mode === "runtime";',
  },
  F1: {
    control: "modal",
    expected: "field-pair",
    file: story,
    from: '<Field name="state">',
    to: '<Field className="col-span-full" name="state">',
  },
  F2: {
    control: "modal-narrow",
    expected: "field-pair",
    file: story,
    from: "@min-[320px]:grid-cols-[minmax(0,1fr)_5rem]",
    to: "grid-cols-[minmax(0,1fr)_5rem]",
  },
  S1: {
    control: "semantic-control",
    expected: null,
    file: story,
    from: '{addressField}\n      </FormSection>\n      <FormSection title="Município">\n        <CityAndState />',
    to: '</FormSection>\n      <FormSection title="Município">\n        <CityAndState />\n        {addressField}',
  },
  C3: {
    control: "two-long",
    expected: "single-choice",
    file: story,
    from: 'const segmented = mode === "short";',
    to: 'const segmented = mode === "short" || mode === "long";',
  },
};
