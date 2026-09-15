import type { LucideIcon } from "lucide-react";
import { Home, Receipt, Users } from "lucide-react";

import type { StaffRole } from "@lazuli/auth/server";

/**
 * Single source of which screens each role can open. The sidebar renders from
 * it, and the home route redirects by it, so a link never points a role at a
 * procedure that will deny them.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles that can open the target screen; mirrors the backend procedures. */
  roles: readonly StaffRole[];
};

export type NavSection = {
  id: string;
  label: string | null;
  items: readonly NavItem[];
};

export type NavBreadcrumb = { section: string; page: string };

const EVERY_ROLE: readonly StaffRole[] = ["ADMIN", "SECRETARY", "TEACHER", "FINANCE"];

/*
 * Only what exists today. Sections grow with shipped verticals instead of
 * promising screens that are not built (IA: navigation model).
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: "primary",
    label: null,
    items: [{ href: "/", label: "Início", icon: Home, roles: EVERY_ROLE }],
  },
  {
    id: "pedagogico",
    label: "Pedagógico",
    // students.* is adminProcedure; staffProcedure is deferred debt (PR #46).
    items: [{ href: "/alunos", label: "Alunos", icon: Users, roles: ["ADMIN"] }],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    items: [{ href: "/parcelas", label: "Parcelas", icon: Receipt, roles: ["ADMIN"] }],
  },
];

export function navItemsFor(role: StaffRole): NavItem[] {
  return navSectionsFor(role).flatMap((section) => section.items);
}

/** Empty sections disappear when none of their items are available to a role. */
export function navSectionsFor(role: StaffRole): NavSection[] {
  return NAV_SECTIONS.flatMap((section) => {
    const items = section.items.filter((item) => item.roles.includes(role));

    return items.length === 0 ? [] : [{ ...section, items }];
  });
}

export function matchesNavHref(input: { href: string; pathname: string }): boolean {
  return input.href === "/"
    ? input.pathname === input.href
    : input.pathname === input.href || input.pathname.startsWith(`${input.href}/`);
}

/** Breadcrumb for a grouped page; primary items and unauthorized routes have none. */
export function navBreadcrumbFor(pathname: string, role: StaffRole): NavBreadcrumb | null {
  for (const section of navSectionsFor(role)) {
    if (section.label === null) {
      continue;
    }

    const page = section.items.find((item) => matchesNavHref({ href: item.href, pathname }));
    if (page !== undefined) {
      return { section: section.label, page: page.label };
    }
  }

  return null;
}

/** Where Início lands for this role; null when no vertical is open to it yet. */
export function homeHrefFor(role: StaffRole): string | null {
  const vertical = navItemsFor(role).find((item) => item.href !== "/");

  return vertical?.href ?? null;
}
