import type { LucideIcon } from "lucide-react";
import { Home, Users } from "lucide-react";

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

const EVERY_ROLE: readonly StaffRole[] = ["ADMIN", "SECRETARY", "TEACHER", "FINANCE"];

/*
 * Only what exists today: Início (a redirect to the role's first vertical) and
 * Alunos. The list grows one item per shipped vertical instead of promising
 * screens that are not built (IA: navigation model).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Início", icon: Home, roles: EVERY_ROLE },
  // students.* is adminProcedure; staffProcedure is deferred debt (PR #46).
  { href: "/alunos", label: "Alunos", icon: Users, roles: ["ADMIN"] },
];

export function navItemsFor(role: StaffRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/** Where Início lands for this role; null when no vertical is open to it yet. */
export function homeHrefFor(role: StaffRole): string | null {
  const vertical = navItemsFor(role).find((item) => item.href !== "/");

  return vertical?.href ?? null;
}
