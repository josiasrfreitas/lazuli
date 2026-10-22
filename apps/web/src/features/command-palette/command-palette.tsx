"use client";

import type { JSX as ReactJSX, Dispatch, SetStateAction } from "react";
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
import { Badge, Button, CommandMenu, type CommandMenuItem } from "@lazuli/ui";
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
type Scope = { command: Command; query: string };
type PaletteControls = {
  open: boolean;
  query: string;
  scope: Scope | null;
  setQuery: Dispatch<SetStateAction<string>>;
  setScope: Dispatch<SetStateAction<Scope | null>>;
  changeOpen: (next: boolean) => void;
};

function commandGroup(input: { scoped: boolean; first: boolean; query: string }): string {
  const { scoped, first, query } = input;
  if (scoped) return "Destinos do aluno";
  if (!query) return "Ir para";
  return first ? "Melhor resultado" : "Outros destinos";
}

function usePaletteControls(pathname: string, studentSection: string | null): PaletteControls {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope | null>(null);
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
  return { open, query, scope, setQuery, setScope, changeOpen };
}

function useRankedPaletteCommands(input: {
  role: StaffRole;
  pathname: string;
  studentSection: string | null;
  scope: Scope | null;
  query: string;
  lookupData: ReturnType<typeof useCommandSearch>["data"];
}): Command[] {
  const { role, pathname, studentSection, scope, query, lookupData } = input;
  return useMemo(() => {
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
      [...contextCommands(role, pathname), ...pageCommands(role), ...entityCommands(lookupData)],
      { query, context },
    ).map((command) => preferredCommand(command, { intent: searchIntent(query), context }));
  }, [scope, pathname, studentSection, role, query, lookupData]);
}

function usePaletteItems(input: {
  commands: Command[];
  scope: Scope | null;
  query: string;
}): CommandMenuItem[] {
  const { commands, scope, query } = input;
  return useMemo(
    () =>
      commands.map((command, index) => {
        const Icon = ICONS[command.icon];
        return {
          id: command.id,
          label: command.title,
          description: command.description,
          group: commandGroup({ scoped: Boolean(scope), first: index === 0, query }),
          icon: <Icon />,
          expandable: Boolean(command.actions?.length),
          hint:
            command.kind === "student"
              ? (command.href.includes("financeiro")
                ? "Financeiro"
                : "Pedagógico")
              : undefined,
        };
      }),
    [commands, scope, query],
  );
}

export function CommandPalette({ role }: { role: StaffRole }): ReactJSX.Element {
  const pathname = usePathname();
  const studentSection = useSearchParams().get("secao");
  const controls = usePaletteControls(pathname, studentSection);
  const { open, query, scope } = controls;
  const intent = searchIntent(query);
  const lookup = useCommandSearch(
    intent.entityQuery,
    open && !scope && (role === "ADMIN" || role === "SYSTEM_ADMIN"),
  );
  const commands = useRankedPaletteCommands({
    role,
    pathname,
    studentSection,
    scope,
    query,
    lookupData: lookup.data,
  });
  const items = usePaletteItems({ commands, scope, query });
  return <PaletteMenuView controls={controls} commands={commands} items={items} lookup={lookup} />;
}

function PaletteMenuView({
  controls,
  commands,
  items,
  lookup,
}: {
  controls: PaletteControls;
  commands: Command[];
  items: CommandMenuItem[];
  lookup: ReturnType<typeof useCommandSearch>;
}): ReactJSX.Element {
  const router = useRouter();
  const { open, query, scope, setQuery, setScope, changeOpen } = controls;
  return (
    <CommandMenu
      open={open}
      onOpenChange={changeOpen}
      trigger={<PaletteTrigger />}
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

function PaletteTrigger(): ReactJSX.Element {
  return (
    <Button variant="ghost" size="compact-responsive" aria-label="Buscar no sistema">
      <Search className="md:hidden" aria-hidden="true" />
      <Badge className="hidden md:inline-flex" aria-hidden="true">
        ⌘ + K
      </Badge>
      <span>Buscar</span>
    </Button>
  );
}
