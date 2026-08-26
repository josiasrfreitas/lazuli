"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { StaffRole } from "@lazuli/auth/server";
import { cn } from "@lazuli/ui";

import { navItemsFor } from "./nav-items";

function isActive({ href, pathname }: { href: string; pathname: string }): boolean {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function SidebarNav({ role }: { role: StaffRole }): ReactNode {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-1 px-3">
      {navItemsFor(role).map(({ href, icon: Icon, label }) => {
        const active = isActive({ href, pathname });

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-control",
              "transition-colors duration-fast ease-standard",
              "focus-visible:outline-none focus-visible:shadow-focus",
              active
                ? "bg-secondary font-semibold text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
            href={href}
            key={href}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
