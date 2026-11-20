export const THEME_STORAGE_KEY = "lazuli-theme";

/** Synchronous head script. The server fallback is also dark when storage is unavailable. */
export const THEME_BOOTSTRAP = `(() => {
  const key = '${THEME_STORAGE_KEY}';
  function apply(saved) {
    const light = saved === 'light';
    const root = document.documentElement;
    root.classList.toggle('light', light);
    root.classList.toggle('dark', !light);
    root.dataset.theme = light ? 'light' : 'dark';
  }
  try { apply(localStorage.getItem(key)); } catch { apply(null); }
  window.addEventListener('storage', (event) => {
    if (event.storageArea === localStorage && (event.key === key || event.key === null)) {
      apply(event.newValue);
    }
  });
})();`;

export function toggleTheme(): void {
  const root = document.documentElement;
  const light = root.dataset.theme !== "light";
  const theme = light ? "light" : "dark";
  root.classList.toggle("dark", !light);
  root.classList.toggle("light", light);
  root.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The choice still applies to this document when storage is blocked.
  }
}
