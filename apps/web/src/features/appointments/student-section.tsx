"use client";
import type { ReactElement } from "react";
import Link from "next/link";
import type { RouterOutputs } from "@lazuli/api";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { RecordState } from "~/features/class-records/shared";
import { ProfileRecordList } from "~/features/students/profile/profile-record-list";
import { AppointmentBadge, monthBounds, purposes, shiftMonth, today } from "./shared";

type AppointmentRow = RouterOutputs["appointments"]["list"][number];

export function StudentAppointments({ studentId }: { studentId: string }): ReactElement {
  const month = today().slice(0, 7);
  const range = {
    from: monthBounds(shiftMonth(month, -1)).from,
    through: monthBounds(shiftMonth(month, 1)).through,
  };
  const agenda = trpc.appointments.list.useQuery({ ...range, studentId });
  const rows = [...(agenda.data ?? [])].sort(
    (a, b) =>
      Number(b.status === "SCHEDULED") - Number(a.status === "SCHEDULED") ||
      (a.status === "SCHEDULED" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)),
  );
  return (
    <section
      aria-label="Atendimentos do aluno"
      className="grid min-w-0 content-start gap-4 border border-border bg-accent p-5 xl:col-span-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight text-heading">
            Atendimentos
          </h2>
          <p className="mt-1 text-caption text-muted-foreground">
            Reposições, reforço e apoio ao aluno
          </p>
        </div>
        <Button
          variant="link"
          size="inline"
          nativeButton={false}
          render={<Link href={`/atendimentos?aluno=${studentId}`} />}
        >
          Ver agenda <ArrowUpRight aria-hidden="true" />
        </Button>
      </div>
      <RecordState
        pending={agenda.isPending}
        error={agenda.error}
        retry={() => {
          void agenda.refetch();
        }}
      />
      {agenda.data && (
        <div className="grid gap-3">
          <p className="border-b border-border pb-3 text-caption text-muted-foreground">
            {formatDateOnlyBR(range.from)} a {formatDateOnlyBR(range.through)}
          </p>
          {rows.length > 0 && (
            <ProfileRecordList total={rows.length} label="Atendimentos no período">
              {rows.map((row) => (
                <li key={row.id}>
                  <AppointmentItem row={row} />
                </li>
              ))}
            </ProfileRecordList>
          )}
          {!rows.length && (
            <p className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
              <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-icon" />
              Nenhum atendimento neste período.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function AppointmentItem({ row }: { row: AppointmentRow }): ReactElement {
  const date = new Date(`${row.date}T12:00:00Z`);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
    .format(date)
    .replace(".", "");
  return (
    <Link
      href={`/atendimentos/${row.id}`}
      className="group flex items-start gap-3 py-4 outline-offset-2 transition-colors hover:text-interactive focus-visible:outline-2 focus-visible:outline-ring"
    >
      <time
        dateTime={row.date}
        className="grid w-12 shrink-0 justify-items-center border-r border-border pr-3 text-heading"
      >
        <span className="font-display text-3xl font-medium leading-none tabular-nums">
          {row.date.slice(8)}
        </span>
        <span className="mt-1 text-micro uppercase">{month}</span>
      </time>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{purposes[row.purpose]}</h3>
          <AppointmentBadge status={row.status} overdue={row.overdue} />
        </div>
        <p className="mt-1 text-caption text-muted-foreground">
          <span className="font-numeric tabular-nums">
            {row.startTime}–{row.endTime}
          </span>{" "}
          · <span className="break-words">{row.teacher?.name ?? "Professor a definir"}</span>
        </p>
      </div>
      <ArrowUpRight className="size-3.5 shrink-0 text-icon" aria-hidden="true" />
    </Link>
  );
}
