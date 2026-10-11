"use client";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import { useQueryState, parseAsString } from "nuqs";
import { ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { Badge, Button, EmptyState, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { dateLabel, RecordState } from "./shared";
function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function currentMonday() {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return shiftDate(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
}
export function ClassAgenda(): ReactElement {
  const [week, setWeek] = useQueryState("semana", parseAsString.withDefault(currentMonday()));
  const [classId] = useQueryState("turma", parseAsString);
  const [view, setView] = useState("all");
  const from =
    /^\d{4}-\d{2}-\d{2}$/.test(week) && !Number.isNaN(new Date(week).getTime())
      ? week
      : currentMonday();
  const to = shiftDate(from, 6);
  const query = trpc.classRecords.list.useQuery({ from, to, ...(classId ? { classId } : {}) });
  const rows = (query.data ?? []).filter((row) => view === "all" || row.state === view);
  const dates = [...new Set(rows.map((row) => row.date))];
  return (
    <div className="mx-auto grid h-full w-full max-w-6xl content-start gap-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-h2 font-semibold text-heading">Aulas</h1>
          <p className="mt-1 text-caption text-muted-foreground">
            Acompanhe cada encontro, da chamada ao que foi realizado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon-sm"
            variant="secondary"
            aria-label="Semana anterior"
            onClick={() => void setWeek(shiftDate(from, -7))}
          >
            <ChevronLeft />
          </Button>
          <Button variant="ghost" onClick={() => void setWeek(currentMonday())}>
            Esta semana
          </Button>
          <Button
            size="icon-sm"
            variant="secondary"
            aria-label="Próxima semana"
            onClick={() => void setWeek(shiftDate(from, 7))}
          >
            <ChevronRight />
          </Button>
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <h2 className="font-display text-xl font-semibold">
          {dateLabel(from)} — {dateLabel(to)}
        </h2>
        <div className="max-w-full overflow-x-auto">
          <SegmentedControl
            value={view}
            onValueChange={(value) => {
              if (value) setView(value);
            }}
            aria-label="Situação das aulas"
          >
            <SegmentedControlItem value="all">Todas</SegmentedControlItem>
            <SegmentedControlItem value="PENDING">A registrar</SegmentedControlItem>
            <SegmentedControlItem value="RECORDED">Com baixa</SegmentedControlItem>
          </SegmentedControl>
        </div>
      </div>
      {classId && (
        <div className="flex flex-wrap items-center gap-3 text-caption">
          <span className="text-muted-foreground">
            Turma: {query.data?.[0]?.className ?? "selecionada"}
          </span>
          <Link className="text-interactive hover:underline" href={`/aulas?semana=${from}`}>
            Ver todas as turmas
          </Link>
        </div>
      )}
      <RecordState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && rows.length === 0 && (
        <EmptyState
          title="Nenhum encontro neste recorte"
          description="Escolha outra semana ou veja todas as situações."
        />
      )}
      {dates.map((date) => (
        <section key={date} className="grid gap-3 sm:grid-cols-5">
          <h3 className="pt-3 text-caption font-semibold text-muted-foreground">
            {new Intl.DateTimeFormat("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "short",
              timeZone: "UTC",
            }).format(new Date(`${date}T12:00:00Z`))}
          </h3>
          <div className="divide-y divide-border rounded-lg border border-border bg-card sm:col-span-4">
            {rows
              .filter((row) => row.date === date)
              .map((row) => (
                <article
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <span className="font-numeric text-caption tabular-nums text-muted-foreground">
                      {row.startTime}
                      <br />
                      {row.endTime}
                    </span>
                    <div className="grid gap-1">
                      <h4 className="text-sm font-semibold">{row.className}</h4>
                      <p className="text-caption text-muted-foreground">
                        {row.teacher ?? "Professor a definir"} ·{" "}
                        {row.scheduleType === "REGULAR" ? "Regular" : "PPT"}
                      </p>
                      {row.attendanceOnly && (
                        <span className="text-micro text-muted-foreground">
                          Chamada confirmada · conteúdo a registrar
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={row.state === "RECORDED" ? "success" : "neutral"}>
                      {row.state === "RECORDED"
                        ? "Com baixa"
                        : row.state === "CANCELLED"
                          ? "Cancelada"
                          : "A registrar"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/aulas/${row.id}`} />}
                      aria-label={`Abrir ${row.className} em ${dateLabel(date)} às ${row.startTime}`}
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
    </div>
  );
}
