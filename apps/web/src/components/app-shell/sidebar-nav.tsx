"use client";

import type { ReactNode } from "react";

import { Home, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@lazuli/ui";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/*
 * Only what exists today: Início (a redirect to the sole vertical) and Alunos.
 * The list grows one item per shipped vertical instead of promising screens
 * that are not built (IA: navigation model).
 */
const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Início", icon: Home },
  { href: "/alunos", label: "Alunos", icon: Users },
];

function isActive({ href, pathname }: { href: string; pathname: string }): boolean {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function SidebarNav(): ReactNode {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
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
