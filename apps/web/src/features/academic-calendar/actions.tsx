"use client";

import { useState, type ReactElement } from "react";
import { CalendarRange, Flag, RefreshCw, Settings2 } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger, toastManager } from "@lazuli/ui";
import { notifyCalendarExecution } from "./execution-notifications";
import { createJobNotifier } from "~/features/shared/job-toast";
import { trpc } from "~/lib/trpc";

const notifier = createJobNotifier();
function notifyEmptyQueue(year: number): void {
  notifier.notify({
    key: `empty-calendar:${year}`,
    state: crypto.randomUUID(),
    title: "Nenhuma atualização pendente neste ano",
    outcome: "success",
  });
}

export function CalendarActions({
  year,
  disabled,
  onConfigure,
}: {
  year: number;
  disabled: boolean;
  onConfigure: (section?: string) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const run = trpc.calendar.academic.changes.runPending.useMutation({
    onSuccess: async ({ pending, executions }) => {
      for (const execution of executions)
        notifyCalendarExecution({
          id: execution.id,
          state: execution.dispatched ? "QUEUED" : "UNAVAILABLE",
        });
      await utils.calendar.academic.invalidate();
      setOpen(false);
      if (pending === 0) notifyEmptyQueue(year);
    },
    onError: (error) => toastManager.add({ title: error.message, type: "error", timeout: 0 }),
  });
  function configure(section: string): void {
    setOpen(false);
    onConfigure(section);
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled || run.isPending}
            data-calendar-configure-trigger
          />
        }
      >
        <Settings2 aria-hidden="true" /> Configurar
      </PopoverTrigger>
      <PopoverContent align="end" size="menu" showArrow={false}>
        <CalendarActionMenu
          configure={configure}
          pending={run.isPending}
          run={() => run.mutate({ year })}
        />
      </PopoverContent>
    </Popover>
  );
}

function CalendarActionMenu({
  configure,
  pending,
  run,
}: {
  configure: (section: string) => void;
  pending: boolean;
  run: () => void;
}): ReactElement {
  return (
    <div className="grid gap-1">
      <Button
        className="w-full justify-start"
        variant="ghost"
        size="sm"
        onClick={() => configure("semestres")}
      >
        <CalendarRange aria-hidden="true" /> Semestres
      </Button>
      <Button
        className="w-full justify-start"
        variant="ghost"
        size="sm"
        onClick={() => configure("interrupcoes")}
      >
        <Flag aria-hidden="true" /> Feriados e recessos
      </Button>
      <Button
        className="w-full justify-start"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={run}
      >
        <RefreshCw aria-hidden="true" />{" "}
        {pending ? "Solicitando…" : "Atualizar atividades pendentes"}
      </Button>
      <p className="max-w-72 px-3 py-2 text-caption text-muted-foreground">
        Alterações confirmadas atualizam as atividades automaticamente. Pendências também são
        recuperadas diariamente às 3h.
      </p>
    </div>
  );
}
