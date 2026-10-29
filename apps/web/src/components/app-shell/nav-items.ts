import {
  type LucideIcon,
  ChartNoAxesCombined,
  CalendarRange,
  BookOpen,
  DollarSign,
  FileText,
  GraduationCap,
  Home,
  History,
  Settings,
  Users,
  UserRoundPlus,
} from "lucide-react";
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

const EVERY_ROLE: readonly StaffRole[] = [
  "SYSTEM_ADMIN",
  "ADMIN",
  "SECRETARY",
  "TEACHER",
  "FINANCE",
];

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
    items: [
      { href: "/alunos", label: "Alunos", icon: Users, roles: ["ADMIN", "SYSTEM_ADMIN"] },
      {
        href: "/professores",
        label: "Professores",
        icon: GraduationCap,
        roles: ["ADMIN", "SYSTEM_ADMIN"],
      },
      { href: "/turmas", label: "Turmas", icon: BookOpen, roles: ["ADMIN", "SYSTEM_ADMIN"] },
      {
        href: "/aulas",
        label: "Agenda",
        icon: CalendarRange,
        roles: ["ADMIN", "SYSTEM_ADMIN", "TEACHER"],
      },
      {
        href: "/estagios",
        label: "Estágios",
        icon: BookOpen,
        roles: ["ADMIN", "SYSTEM_ADMIN"],
      },
      { href: "/avaliacoes", label: "Avaliações", icon: GraduationCap, roles: ["TEACHER"] },
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    items: [
      {
        href: "/interessados",
        label: "Leads",
        icon: UserRoundPlus,
        roles: ["ADMIN", "SYSTEM_ADMIN"],
      },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    items: [
      {
        href: "/financeiro",
        label: "Visão financeira",
        icon: ChartNoAxesCombined,
        roles: ["ADMIN", "SYSTEM_ADMIN"],
      },
      { href: "/contratos", label: "Contratos", icon: FileText, roles: ["ADMIN", "SYSTEM_ADMIN"] },
      {
        href: "/recebiveis",
        label: "Recebíveis",
        icon: DollarSign,
        roles: ["ADMIN", "SYSTEM_ADMIN"],
      },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    items: [
      {
        href: "/atividades",
        label: "Log de atividades",
        icon: History,
        roles: ["ADMIN", "SYSTEM_ADMIN"],
      },
      { href: "/ajustes", label: "Ajustes", icon: Settings, roles: ["SYSTEM_ADMIN"] },
      {
        href: "/configuracoes/presenca",
        label: "Localização da escola",
        icon: Settings,
        roles: ["ADMIN", "SYSTEM_ADMIN"],
      },
    ],
  },
];

export function navItemsFor(role: StaffRole): NavItem[] {
  return navSectionsFor(role).flatMap((section) => section.items);
}

/** Empty sections disappear when none of their items are available to a role. */
export function navSectionsFor(role: StaffRole): NavSection[] {
  if (role === "TEACHER")
    return [
      {
        id: "professor",
        label: null,
        items: [
          { href: "/professor", label: "Meu início", icon: Home, roles: ["TEACHER"] },
          {
            href: "/professor/agenda",
            label: "Minha agenda",
            icon: CalendarRange,
            roles: ["TEACHER"],
          },
          { href: "/professor/turmas", label: "Minhas turmas", icon: BookOpen, roles: ["TEACHER"] },
          { href: "/professor/alunos", label: "Meus alunos", icon: Users, roles: ["TEACHER"] },
          {
            href: "/professor/acompanhamento",
            label: "Acompanhamento",
            icon: History,
            roles: ["TEACHER"],
          },
          {
            href: "/avaliacoes",
            label: "Notas e avaliações",
            icon: GraduationCap,
            roles: ["TEACHER"],
          },
        ],
      },
    ];
  return NAV_SECTIONS.flatMap((section) => {
    const items = section.items.filter((item) => item.roles.includes(role));

    return items.length === 0 ? [] : [{ ...section, items }];
  });
}

export function matchesNavHref(input: MatchesNavHrefInput): boolean {
  if (input.href === "/professor") return input.pathname === input.href;
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

/** Administrative home or the role workspace; null when no workspace is enabled. */
export function homeHrefFor(role: StaffRole): string | null {
  if (role === "ADMIN" || role === "SYSTEM_ADMIN") return "/";
  const vertical = navItemsFor(role).find((item) => item.href !== "/");

  return vertical?.href ?? null;
}

/** Child pages return to their source when it is an accessible app route. */
export function navReturnFor({
  pathname,
  role,
  back,
}: NavReturnForInput): { href: string; label: string } | null {
  const parent = navItemsFor(role).find(
    (item) => item.href !== "/" && pathname.startsWith(`${item.href}/`),
  );
  if (!parent) return null;
  return (
    returnDestination({ back, parent, items: navItemsFor(role) }) ?? {
      href: parent.href,
      label: parent.label,
    }
  );
}

function returnDestination({
  back,
  parent,
  items,
}: {
  back: string | null;
  parent: NavItem;
  items: NavItem[];
}): { href: string; label: string } | null {
  if (!back?.startsWith("/") || back.startsWith("//")) return null;
  let url: URL;
  try {
    url = new URL(back, "https://lazuli.local");
  } catch {
    return null;
  }
  if (url.origin !== "https://lazuli.local") return null;
  const item = items.find(
    (candidate) =>
      candidate.href === url.pathname ||
      (candidate.href !== parent.href &&
        ["/alunos", "/professores", "/turmas"].includes(candidate.href) &&
        url.pathname.startsWith(`${candidate.href}/`) &&
        url.pathname.slice(candidate.href.length + 1).split("/").length === 1),
  );
  if (!item) return null;
  const detailLabel: Record<string, string> = {
    "/alunos": "Aluno",
    "/professores": "Professor",
    "/turmas": "Turma",
  };
  return {
    href: `${url.pathname}${url.search}`,
    label: item.href === url.pathname ? item.label : (detailLabel[item.href] ?? item.label),
  };
}

type MatchesNavHrefInput = { href: string; pathname: string };
type NavReturnForInput = { pathname: string; role: StaffRole; back: string | null };
