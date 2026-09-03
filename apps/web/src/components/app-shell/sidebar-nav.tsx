"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { StaffRole } from "@lazuli/auth/server";
import { cn } from "@lazuli/ui";

import { matchesNavHref, navSectionsFor, type NavItem, type NavSection } from "./nav-items";

export function SidebarNav({ role }: { role: StaffRole }): ReactNode {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-5 px-3">
      {navSectionsFor(role).map((section) => (
        <SidebarNavSection key={section.id} pathname={pathname} section={section} />
      ))}
    </nav>
  );
}

function SidebarNavSection({
  pathname,
  section,
}: {
  pathname: string;
  section: NavSection;
}): ReactNode {
  const labelId = `nav-section-${section.id}`;

  return (
    <div aria-labelledby={section.label === null ? undefined : labelId} role="group">
      {section.label === null ? null : (
        <p
          className="mb-1 px-3 text-micro font-semibold uppercase tracking-wider text-muted-foreground"
          id={labelId}
        >
          {section.label}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {section.items.map((item) => (
          <SidebarNavLink item={item} key={item.href} pathname={pathname} />
        ))}
      </div>
    </div>
  );
}

function SidebarNavLink({ item, pathname }: { item: NavItem; pathname: string }): ReactNode {
  const { href, icon: Icon, label } = item;
  const active = matchesNavHref({ href, pathname });

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-2.5 rounded-md px-3 py-2 text-control sm:min-h-0",
        "transition-colors duration-fast ease-standard",
        "focus-visible:outline-none focus-visible:shadow-focus",
        active
          ? "bg-secondary font-semibold text-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
      href={href}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {label}
    </Link>
  );
}
