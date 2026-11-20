import assert from "node:assert/strict";
import { it } from "node:test";
import { runInNewContext } from "node:vm";
import { THEME_BOOTSTRAP, THEME_STORAGE_KEY, toggleTheme } from "../../src/lib/theme.js";

type TestPage = {
  document: object;
  localStorage: Pick<Storage, "getItem" | "setItem">;
  window: EventTarget;
  load(): void;
  expectTheme(theme: string): void;
};

function page(saved: string | null, blocked = false): TestPage {
  const classes = new Set(["dark", "application"]);
  const documentElement = {
    dataset: { theme: "dark" },
    classList: {
      toggle(name: string, enabled: boolean) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
  };
  const localStorage = {
    getItem(key: string) {
      if (blocked) throw new Error("Storage blocked");
      return key === THEME_STORAGE_KEY ? saved : null;
    },
    setItem(key: string, value: string) {
      if (blocked) throw new Error("Storage blocked");
      assert.equal(key, THEME_STORAGE_KEY);
      saved = value;
    },
  };
  const window = new EventTarget();
  const document = { documentElement };
  function load(): void {
    runInNewContext(THEME_BOOTSTRAP, { document, localStorage, window });
  }
  function expectTheme(theme: string): void {
    assert.equal(documentElement.dataset.theme, theme);
    assert.deepEqual(classes, new Set(["application", theme]));
  }
  return { document, localStorage, window, load, expectTheme };
}

for (const [preference, expected] of [
  [null, "dark"],
  ["system", "dark"],
  ["dark", "dark"],
  ["light", "light"],
] as const) {
  void it(`boots the document in ${expected} for preference ${String(preference)}`, () => {
    const tab = page(preference);
    tab.load();
    tab.expectTheme(expected);
  });
}

for (const blocked of [false, true]) {
  void it(`switches both ways with storage ${blocked ? "blocked" : "available"}`, (context) => {
    const tab = page(null, blocked);
    context.after(() => {
      Reflect.deleteProperty(globalThis, "document");
      Reflect.deleteProperty(globalThis, "localStorage");
    });
    Object.defineProperty(globalThis, "document", { configurable: true, value: tab.document });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: tab.localStorage,
    });
    tab.load();
    toggleTheme();
    tab.expectTheme("light");
    if (!blocked) {
      const nextPage = page(tab.localStorage.getItem(THEME_STORAGE_KEY));
      nextPage.load();
      nextPage.expectTheme("light");
    }
    toggleTheme();
    tab.expectTheme("dark");
    if (!blocked) assert.equal(tab.localStorage.getItem(THEME_STORAGE_KEY), "dark");
  });
}

void it("responds to another tab changing or clearing the preference", () => {
  const tab = page("dark");
  tab.load();
  for (const [key, newValue, expected] of [
    [THEME_STORAGE_KEY, "light", "light"],
    ["another-key", "dark", "light"],
    [null, null, "dark"],
  ] as const) {
    tab.window.dispatchEvent(
      Object.assign(new Event("storage"), { key, newValue, storageArea: tab.localStorage }),
    );
    tab.expectTheme(expected);
  }
});
