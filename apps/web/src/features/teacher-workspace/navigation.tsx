"use client";
import type { JSX as ReactJSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, BookOpen, Users, MessageSquareText } from "lucide-react";
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
