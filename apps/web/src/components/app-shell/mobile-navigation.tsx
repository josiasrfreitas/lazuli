"use client";

import type { ReactElement } from "react";

import { Menu } from "lucide-react";

import type { StaffIdentity } from "@lazuli/auth/server";

import { AccountFooter } from "./account-footer";
import { BrandSignature } from "./brand-signature";
import { SidebarNav } from "./sidebar-nav";

/** Native disclosure keeps navigation available when the desktop sidebar is hidden. */
export function MobileNavigation({ identity }: { identity: StaffIdentity }): ReactElement {
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
        <Menu aria-hidden="true" className="size-5 text-icon" />
        <span className="sr-only">Abrir navegação</span>
      </summary>
      <div className="absolute left-0 top-full z-50 w-54 rounded-lg border border-navigation-border bg-navigation p-3 text-navigation-foreground shadow-lg">
        <div className="mb-3 px-2 pb-3">
          <BrandSignature expanded />
        </div>
        <SidebarNav role={identity.role} />
        <div className="mt-3">
          <AccountFooter identity={identity} />
        </div>
      </div>
    </details>
  );
}
