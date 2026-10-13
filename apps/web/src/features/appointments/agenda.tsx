"use client";
import { useState } from "react";
import Link from "next/link";
import { parseAsString, useQueryStates } from "nuqs";
import { ArrowUpRight, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  Button,
  EmptyState,
  Tabs,
  TabsList,
  TabsTab,
  TableFilters,
  type TableFilterField,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { RecordState } from "~/features/class-records/shared";
import { ScheduleAppointmentDialog } from "./schedule-dialog";
import { AbsenceList } from "./absence-list";
import { AppointmentBadge, monthBounds, purposes, shiftMonth, statuses, today } from "./shared";

export function AppointmentsAgenda() {
  const [params, setParams] = useQueryStates({
    mes: parseAsString.withDefault(today().slice(0, 7)),
    visao: parseAsString.withDefault("agenda"),
    aluno: parseAsString,
    situacao: parseAsString.withDefault(""),
  });
  const me = trpc.me.useQuery();
  const admin = me.data?.role === "ADMIN" || me.data?.role === "SYSTEM_ADMIN";
  const absences = admin && params.visao === "faltas";
  const range = monthBounds(params.mes);
  const query = trpc.appointments.list.useQuery(
    { ...range, ...(params.aluno ? { studentId: params.aluno } : {}) },
    { enabled: !absences },
  );
  const [creating, setCreating] = useState(false);
  const rows = (query.data ?? []).filter(
    (row) => !params.situacao || params.situacao.split(",").includes(row.status),
  );
  const dates = [...new Set(rows.map((row) => row.date))];
  const filters: TableFilterField[] = [
    {
      id: "situacao",
      label: "Situação",
      kind: "options",
      promoted: true,
      options: Object.entries(statuses).map(([id, label]) => ({ id, label })),
      selected: params.situacao ? params.situacao.split(",") : [],
      onChange: (values) => void setParams({ situacao: values.join(",") }),
      onClear: () => void setParams({ situacao: "" }),
    },
  ];
  const recorded = (query.data ?? []).filter((row) => row.status === "ATTENDED");
  const compensated = recorded.reduce(
    (sum, row) =>
      sum +
      row.coverages
        .filter((item) => item.applicable)
        .reduce((minutes, item) => minutes + item.minutes, 0),
    0,
  );
  const student = query.data?.[0]?.student;
  return (
    <div className="mx-auto grid h-full w-full max-w-6xl grid-cols-1 content-start gap-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-h2 font-semibold text-heading">Atendimentos</h1>
          <p className="mt-1 text-caption text-muted-foreground">
            Reposições, complementos PPT e apoio ao percurso de cada aluno.
          </p>
        </div>
        {admin && (
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Agendar atendimento
          </Button>
        )}
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <Tabs
          variant="underline"
          value={absences ? "faltas" : "agenda"}
          onValueChange={(value) => void setParams({ visao: value })}
        >
          <TabsList aria-label="Atendimentos e frequência">
            <TabsTab value="agenda">Agenda</TabsTab>
            {admin && <TabsTab value="faltas">Faltas e reposições</TabsTab>}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button
            size="icon-sm"
            variant="secondary"
            aria-label="Mês anterior"
            onClick={() => void setParams({ mes: shiftMonth(params.mes, -1) })}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-32 text-center text-caption font-semibold">
            {new Intl.DateTimeFormat("pt-BR", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(new Date(range.from))}
          </span>
          <Button
            size="icon-sm"
            variant="secondary"
            aria-label="Próximo mês"
            onClick={() => void setParams({ mes: shiftMonth(params.mes, 1) })}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      {absences ? (
        <AbsenceList key={range.from} {...range} />
      ) : (
        <>
          <div className="grid gap-4 border-b border-border pb-5 sm:grid-cols-3">
            <Metric
              label="Agendados no mês"
              value={String((query.data ?? []).filter((row) => row.status === "SCHEDULED").length)}
              detail="Encontros que aguardam realização"
            />
            <Metric
              label="A registrar"
              value={String((query.data ?? []).filter((row) => row.overdue).length)}
              detail="Horário encerrado, sem resultado"
            />
            <Metric
              label="Tempo compensado"
              value={`${compensated} min`}
              detail="Reposições realizadas neste mês"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-caption text-muted-foreground">
              {params.aluno
                ? `Aluno: ${student?.name ?? "selecionado"}`
                : `${rows.length} atendimentos no recorte`}
              {params.aluno && (
                <Link
                  className="ml-3 text-interactive hover:underline"
                  href={`/atendimentos?mes=${params.mes}`}
                >
                  Ver todos
                </Link>
              )}
            </p>
            <TableFilters fields={filters} onClearAll={() => void setParams({ situacao: "" })} />
          </div>
          <RecordState
            pending={query.isPending}
            error={query.error}
            retry={() => void query.refetch()}
          />
          {query.data && rows.length === 0 && (
            <EmptyState
              title="Nenhum atendimento neste recorte"
              description="Ajuste o período ou a situação para consultar o histórico."
            />
          )}
          {dates.map((date) => (
            <section key={date} className="grid gap-3 sm:grid-cols-5">
              <h2 className="pt-3 text-caption font-semibold text-muted-foreground">
                {new Intl.DateTimeFormat("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "short",
                  timeZone: "UTC",
                }).format(new Date(date))}
              </h2>
              <div className="divide-y divide-border rounded-md border border-border bg-card sm:col-span-4">
                {rows
                  .filter((row) => row.date === date)
                  .map((row) => (
                    <article
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-4"
                    >
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="font-numeric text-caption tabular-nums text-muted-foreground">
                          {row.startTime}
                          <br />
                          {row.endTime}
                        </div>
                        <div className="grid min-w-0 gap-1">
                          <h3 className="text-sm font-semibold">{row.student.name}</h3>
                          <p className="text-caption text-muted-foreground">
                            {purposes[row.purpose]} · {row.teacher?.name ?? "Professor a definir"}
                          </p>
                          <p className="text-caption text-muted-foreground">
                            {row.targetClassName ??
                              (row.format === "IN_PERSON"
                                ? "Individual presencial"
                                : "Individual online")}
                            {row.destinationCancelled ? " · Aula de destino cancelada" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <AppointmentBadge status={row.status} overdue={row.overdue} />
                        <Button
                          variant="ghost"
                          size="sm"
                          nativeButton={false}
                          render={<Link href={`/atendimentos/${row.id}`} />}
                          aria-label={`Abrir atendimento de ${row.student.name} em ${formatDateOnlyBR(row.date)}`}
                        >
                          Abrir
                          <ArrowUpRight />
                        </Button>
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          ))}
        </>
      )}
      {creating && (
        <ScheduleAppointmentDialog
          {...(params.aluno && student ? { student } : {})}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-caption text-muted-foreground">{label}</span>
      <span className="font-numeric text-3xl font-semibold tabular-nums tracking-tight text-heading">
        {value}
      </span>
      <span className="text-caption text-muted-foreground">{detail}</span>
    </div>
  );
}
