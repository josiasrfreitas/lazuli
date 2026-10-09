"use client";

import { useId, type ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { StaffRole } from "@lazuli/auth/server";
import { cn } from "@lazuli/ui";

import { matchesNavHref, navSectionsFor, type NavItem, type NavSection } from "./nav-items";

export function SidebarNav({ role }: { role: StaffRole }): ReactNode {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="flex w-full flex-col gap-2 px-2.5 sm:px-2">
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
  const labelId = useId();

  return (
    <div aria-labelledby={section.label === null ? undefined : labelId} role="group">
      {section.label === null ? null : (
        <div className="relative flex h-6 items-center overflow-hidden px-2.5 sm:px-1.75">
          <span
            aria-hidden="true"
            className="absolute hidden h-px w-4 bg-navigation-border transition-opacity duration-200 group-hover/sidebar:opacity-0 group-has-[:focus-visible]/sidebar:opacity-0 motion-reduce:transition-none sm:block"
          />
          <p
            className="whitespace-nowrap text-micro font-semibold uppercase tracking-wider text-navigation-muted sm:opacity-0 sm:transition-opacity sm:duration-200 sm:group-hover/sidebar:opacity-100 sm:group-has-[:focus-visible]/sidebar:opacity-100 motion-reduce:transition-none"
            id={labelId}
          >
            {section.label}
          </p>
        </div>
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
      aria-label={label}
      className={cn(
        "relative flex min-h-11 items-center gap-2.5 overflow-hidden rounded-md px-2.5 py-2 text-control sm:min-h-0 sm:px-1.75",
        "transition-colors duration-fast ease-standard",
        "focus-visible:outline-none focus-visible:shadow-focus",
        active
          ? "bg-navigation-active font-semibold text-navigation-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand"
          : "text-navigation-muted hover:bg-navigation-active/60 hover:text-navigation-foreground",
      )}
      href={href}
    >
      <Icon
        aria-hidden="true"
        className={cn("size-4 shrink-0", active ? "text-brand" : "text-navigation-icon")}
      />
      <span className="shrink-0 whitespace-nowrap sm:opacity-0 sm:transition-opacity sm:duration-200 sm:group-hover/sidebar:opacity-100 sm:group-has-[:focus-visible]/sidebar:opacity-100 motion-reduce:transition-none">
        {label}
      </span>
    </Link>
  );
}
