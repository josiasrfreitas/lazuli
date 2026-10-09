"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";

import { Button } from "@lazuli/ui";

import { SYSTEM_THEME_QUERY, THEME_STORAGE_KEY, type Theme } from "~/lib/theme";

const THEME_CHANGE_EVENT = "lazuli-theme-change";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.dataset.theme = theme;
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent): void => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      const saved = event.newValue;
      const fallback = globalThis.matchMedia(SYSTEM_THEME_QUERY).matches ? "dark" : "light";
      applyTheme(saved === "light" || saved === "dark" ? saved : fallback);
      onChange();
    }
  };
  globalThis.addEventListener("storage", onStorage);
  globalThis.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    globalThis.removeEventListener("storage", onStorage);
    globalThis.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

function toggleTheme(): void {
  const next = currentTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // A blocked storage does not prevent switching the current page.
  }
  globalThis.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

function serverTheme(): Theme {
  return "light";
}

export function ThemeToggle(): ReactNode {
  const theme = useSyncExternalStore(subscribe, currentTheme, serverTheme);
  const label = theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro";

  return (
    <Button
      aria-label={label}
      onClick={toggleTheme}
      size="icon-compact-responsive"
      title={label}
      variant="ghost"
    >
      <Sun aria-hidden="true" className="hidden size-4 text-icon dark:block" />
      <Moon aria-hidden="true" className="size-4 text-icon dark:hidden" />
    </Button>
  );
}
