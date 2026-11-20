"use client";

import { Moon, Sun } from "lucide-react";
import type { ReactElement } from "react";
import { Button } from "@lazuli/ui";
import { toggleTheme } from "~/lib/theme";

export function ThemeToggle(): ReactElement {
  return (
    <Button onClick={toggleTheme} size="icon-compact-responsive" variant="ghost">
      <span className="hidden dark:inline-flex">
        <Sun aria-hidden="true" className="size-4" />
        <span className="sr-only">Ativar tema claro</span>
      </span>
      <Moon aria-hidden="true" className="size-4 dark:hidden" />
      <span className="sr-only dark:hidden">Ativar tema escuro</span>
    </Button>
  );
}
