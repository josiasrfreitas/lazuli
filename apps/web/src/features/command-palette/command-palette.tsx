"use client";

import type { JSX as ReactJSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  DollarSign,
  FileText,
  GraduationCap,
  Search,
  type LucideIcon,
  UserRound,
  UserRoundPlus,
  Users,
} from "lucide-react";
import type { StaffRole } from "@lazuli/auth";
import { Badge, Button, CommandMenu } from "@lazuli/ui";
import { contextCommands, entityCommands, pageCommands } from "./catalog";
import { useCommandSearch } from "./logic";
import {
  preferredCommand,
  rankCommands,
  searchIntent,
  type Command,
  type CommandIcon,
} from "./model";

const ICONS: Record<CommandIcon, LucideIcon> = {
  page: ArrowUpRight,
  student: UserRound,
  teacher: GraduationCap,
  class: Users,
  lead: UserRoundPlus,
  action: ArrowUpRight,
  finance: DollarSign,
  pedagogy: BookOpen,
  calendar: CalendarDays,
  contract: FileText,
};

export function CommandPalette({ role }: { role: StaffRole }): ReactJSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<{ command: Command; query: string } | null>(null);
  const intent = searchIntent(query);
  const lookup = useCommandSearch(
    intent.entityQuery,
    open && !scope && (role === "ADMIN" || role === "SYSTEM_ADMIN"),
  );
  const studentSection = params.get("secao");

  function changeOpen(next: boolean): void {
    setOpen(next);
    if (!next) {
      setQuery("");
      setScope(null);
    }
  }
  useEffect(() => {
    function keydown(event: KeyboardEvent): void {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !event.isComposing
      ) {
        event.preventDefault();
        if (!event.repeat) setOpen((current) => !current);
      }
    }
    globalThis.addEventListener("keydown", keydown);
    return () => globalThis.removeEventListener("keydown", keydown);
  }, []);
  useEffect(() => {
    setOpen(false);
    setQuery("");
    setScope(null);
  }, [pathname, studentSection]);
  useEffect(() => {
    if (!open) {
      setQuery("");
      setScope(null);
    }
  }, [open]);

  const commands = useMemo(() => {
    const context = { pathname, studentSection };
    if (scope) {
      const actions: Command[] = (scope.command.actions ?? []).map((action) => ({
        ...action,
        kind: "action",
        section: "Destinos do aluno",
        keywords: [action.description],
      }));
      return rankCommands(actions, { query, context });
    }
    return rankCommands(
      [...contextCommands(role, pathname), ...pageCommands(role), ...entityCommands(lookup.data)],
      { query, context },
    ).map((command) => preferredCommand(command, { intent: searchIntent(query), context }));
  }, [scope, pathname, studentSection, role, query, lookup.data]);
  const items = useMemo(
    () =>
      commands.map((command, index) => {
        const Icon = ICONS[command.icon];
        return {
          id: command.id,
          label: command.title,
          description: command.description,
          group: scope
            ? "Destinos do aluno"
            : index === 0 && query
              ? "Melhor resultado"
              : query
                ? "Outros destinos"
                : "Ir para",
          icon: <Icon />,
          expandable: Boolean(command.actions?.length),
          hint:
            command.kind === "student"
              ? command.href.includes("financeiro")
                ? "Financeiro"
                : "Pedagógico"
              : undefined,
        };
      }),
    [commands, scope, query],
  );

  return (
    <CommandMenu
      open={open}
      onOpenChange={changeOpen}
      trigger={
        <Button variant="ghost" size="compact-responsive" aria-label="Buscar no sistema">
          <Search className="md:hidden" aria-hidden="true" />
          <Badge className="hidden md:inline-flex" aria-hidden="true">
            ⌘ + K
          </Badge>
          <span>Buscar</span>
        </Button>
      }
      query={query}
      onQueryChange={setQuery}
      items={items}
      scope={
        scope ? { title: scope.command.title, description: scope.command.description } : undefined
      }
      pending={!scope && lookup.pending}
      error={!scope && lookup.error}
      onRetry={lookup.retry}
      onSelect={(id) => {
        const command = commands.find((item) => item.id === id);
        if (command) {
          changeOpen(false);
          router.push(command.href);
        }
      }}
      onExpand={(id) => {
        const command = commands.find((item) => item.id === id);
        if (command?.actions?.length) {
          setScope({ command, query });
          setQuery("");
        }
      }}
      onBack={() => {
        setQuery(scope?.query ?? "");
        setScope(null);
      }}
    />
  );
}
