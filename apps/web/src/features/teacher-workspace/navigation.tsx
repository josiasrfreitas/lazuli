"use client";
import type { JSX as ReactJSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CalendarDays,
  BookOpen,
  Users,
  MessageSquareText,
  ClipboardList,
} from "lucide-react";
import { trpc } from "~/lib/trpc";
import styles from "./navigation.module.css";

export function TeacherNavigation(): ReactJSX.Element {
  const pathname = usePathname();
  const links = [
    { href: "/professor", label: "Início", icon: Home },
    { href: "/professor/agenda", label: "Agenda", icon: CalendarDays },
    { href: "/professor/turmas", label: "Turmas", icon: BookOpen },
    { href: "/professor/alunos", label: "Alunos", icon: Users },
    { href: "/professor/acompanhamento", label: "Acompanhar", icon: MessageSquareText },
  ];
  return (
    <nav
      aria-label="Navegação do professor"
      className={`${styles.navigation} grid shrink-0 grid-cols-5 border-t border-border bg-card sm:hidden`}
    >
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/professor" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 text-micro ${active ? "font-semibold text-interactive" : "text-muted-foreground"}`}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TeacherPendingNotice(): ReactJSX.Element | null {
  const pending = trpc.teacherWorkspace.pending.useQuery(undefined, { refetchInterval: 60_000 });
  if (!pending.data?.length && !pending.error) return null;
  const label = pending.error
    ? "Não foi possível atualizar as pendências. Consultar"
    : `${pending.data.length} ${pending.data.length === 1 ? "aula por registrar" : "aulas por registrar"}`;
  return (
    <Link
      href="/professor/pendencias"
      aria-label={label}
      title={label}
      className="flex min-h-11 shrink-0 items-center gap-1 rounded-sm px-2 text-caption text-interactive hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
    >
      <ClipboardList className="size-4 shrink-0" aria-hidden="true" />
      <span aria-hidden="true">{pending.error ? "!" : pending.data.length}</span>
      <span aria-hidden="true" className="hidden sm:inline">
        por registrar
      </span>
    </Link>
  );
}
