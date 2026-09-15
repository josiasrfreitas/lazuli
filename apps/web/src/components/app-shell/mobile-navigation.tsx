"use client";

import type { ReactElement } from "react";

import { Menu } from "lucide-react";

import type { StaffRole } from "@lazuli/auth/server";

import { SidebarNav } from "./sidebar-nav";

/** Native disclosure keeps navigation available when the desktop sidebar is hidden. */
export function MobileNavigation({ role }: { role: StaffRole }): ReactElement {
  return (
    <details
      className="relative sm:hidden"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("a") !== null) {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-ring">
        <Menu aria-hidden="true" className="size-5" />
        <span className="sr-only">Abrir navegação</span>
      </summary>
      <div className="absolute left-0 top-full z-50 w-60 rounded-lg border border-border bg-card p-3 shadow-lg">
        <SidebarNav role={role} />
      </div>
    </details>
  );
}
