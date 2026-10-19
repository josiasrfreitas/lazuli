"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, BookOpen, Users, MessageSquareText, ClipboardList } from "lucide-react";
import { trpc } from "~/lib/trpc";

export function TeacherNavigation() {
  const pathname = usePathname();
  const links = [
    { href: "/professor", label: "Agenda", icon: CalendarDays },
    { href: "/professor/turmas", label: "Turmas", icon: BookOpen },
    { href: "/professor/alunos", label: "Alunos", icon: Users },
    { href: "/professor/acompanhamento", label: "Acompanhar", icon: MessageSquareText },
  ];
  return <nav aria-label="Navegação do professor" className="grid shrink-0 grid-cols-4 border-t border-border bg-card pb-2 sm:hidden">
    {links.map(({ href, label, icon: Icon }) => {
      const active = pathname === href || (href !== "/professor" && pathname.startsWith(href));
      return <Link key={href} href={href} aria-current={active ? "page" : undefined}
        className={`flex min-h-14 flex-col items-center justify-center gap-1 text-micro ${active ? "font-semibold text-interactive" : "text-muted-foreground"}`}>
        <Icon className="size-5" aria-hidden="true" />{label}
      </Link>;
    })}
  </nav>;
}

export function TeacherPendingNotice() {
  const pending = trpc.teacherWorkspace.pending.useQuery(undefined, { refetchInterval: 60_000 });
  if (!pending.data?.length && !pending.error) return null;
  return <Link href="/professor/pendencias" className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-2 text-caption text-interactive sm:px-6">
    <ClipboardList className="size-4 shrink-0" />
    {pending.error ? "Não foi possível atualizar as pendências. Consultar" : `${pending.data!.length} ${pending.data!.length === 1 ? "aula por registrar" : "aulas por registrar"}`}
    <span className="ml-auto underline">Revisar</span>
  </Link>;
}
