export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "lazuli-theme";
export const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

/** Runs before the first paint so a saved preference does not flash the opposite theme. */
export const THEME_BOOTSTRAP = `(() => {
  let preference = 'system';
  try {
    const saved = localStorage.getItem('${THEME_STORAGE_KEY}');
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch {}
  const dark = preference === 'dark' || (preference === 'system' && matchMedia('${SYSTEM_THEME_QUERY}').matches);
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);
  root.dataset.theme = dark ? 'dark' : 'light';
})();`;
