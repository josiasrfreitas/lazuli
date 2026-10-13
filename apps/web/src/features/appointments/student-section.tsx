"use client";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import type { RouterOutputs } from "@lazuli/api";
import { ArrowUpRight, CalendarDays, MessageCircle, Phone, Mail, Users } from "lucide-react";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { RecordState } from "~/features/class-records/shared";
import { AbsenceContactDialog } from "./contact-dialog";
import { AppointmentBadge, channels, monthBounds, purposes, shiftMonth, today } from "./shared";

type AppointmentRow = RouterOutputs["appointments"]["list"][number];
type Contact = RouterOutputs["appointments"]["student"]["contacts"][number];
const CONTACT_ICONS = { PHONE: Phone, WHATSAPP: MessageCircle, EMAIL: Mail, IN_PERSON: Users };

export function StudentAppointments({ studentId }: { studentId: string }): ReactElement {
  const [contacting, setContacting] = useState(false);
  const month = today().slice(0, 7);
  const range = {
    from: monthBounds(shiftMonth(month, -1)).from,
    through: monthBounds(shiftMonth(month, 1)).through,
  };
  const agenda = trpc.appointments.list.useQuery({ ...range, studentId });
  const student = trpc.appointments.student.useQuery({ studentId });
  const rows = [...(agenda.data ?? [])].sort(
    (a, b) =>
      Number(b.status === "SCHEDULED") - Number(a.status === "SCHEDULED") ||
      (a.status === "SCHEDULED" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)),
  );
  const contacts = student.data?.contacts ?? [];
  return (
    <section className="grid min-w-0 content-start gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-heading">Atendimentos</h2>
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
        pending={agenda.isPending || student.isPending}
        error={agenda.error ?? student.error}
        retry={() => {
          void agenda.refetch();
          void student.refetch();
        }}
      />
      {agenda.data && (
        <div className="grid gap-1">
          <p className="text-micro text-muted-foreground">
            {formatDateOnlyBR(range.from)} a {formatDateOnlyBR(range.through)}
          </p>
          <div className="divide-y divide-border">
            {rows.slice(0, 5).map((row) => (
              <AppointmentItem key={row.id} row={row} />
            ))}
          </div>
          {!rows.length && (
            <p className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
              <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-icon" />
              Nenhum atendimento neste período.
            </p>
          )}
        </div>
      )}
      <div className="grid gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-heading">Contatos sobre frequência</h3>
          <Button
            variant="link"
            size="inline"
            disabled={!student.data}
            onClick={() => setContacting(true)}
          >
            Registrar contato
          </Button>
        </div>
        {contacts.slice(0, 2).map((row) => (
          <ContactItem key={row.id} row={row} />
        ))}
        {student.data && !contacts.length && (
          <p className="text-sm text-muted-foreground">
            Sem contatos registrados com o aluno ou responsável.
          </p>
        )}
        {contacts.length > 2 && (
          <details>
            <summary className="cursor-pointer py-2 text-caption text-interactive">
              Ver mais {contacts.length - 2} contatos
            </summary>
            <div className="mt-3 grid gap-3">
              {contacts.slice(2).map((row) => (
                <ContactItem key={row.id} row={row} />
              ))}
            </div>
          </details>
        )}
      </div>
      {contacting && student.data && (
        <AbsenceContactDialog
          student={{ id: studentId, name: student.data.student.fullName }}
          onClose={() => setContacting(false)}
        />
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
      className="group flex items-center gap-4 py-3 outline-offset-4 transition-colors hover:text-interactive focus-visible:outline-2 focus-visible:outline-ring"
    >
      <time
        dateTime={row.date}
        className="grid w-10 shrink-0 justify-items-center border-r border-border pr-3 text-heading"
      >
        <span className="font-numeric text-2xl font-semibold leading-none tabular-nums">
          {row.date.slice(8)}
        </span>
        <span className="mt-1 text-micro uppercase">{month}</span>
      </time>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold">{purposes[row.purpose]}</h3>
        <p className="mt-1 text-caption text-muted-foreground">
          <span className="font-numeric tabular-nums">
            {row.startTime}–{row.endTime}
          </span>{" "}
          · {row.teacher?.name ?? "Professor a definir"}
        </p>
      </div>
      <AppointmentBadge status={row.status} overdue={row.overdue} />
      <ArrowUpRight className="size-3.5 shrink-0 text-icon" aria-hidden="true" />
    </Link>
  );
}

function ContactItem({ row }: { row: Contact }): ReactElement {
  const Icon = CONTACT_ICONS[row.channel as keyof typeof CONTACT_ICONS] ?? MessageCircle;
  return (
    <article className="grid gap-2 border-l border-border-strong pl-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-caption">
        <p className="inline-flex items-center gap-2 font-medium text-heading">
          <Icon className="size-3.5 text-icon" aria-hidden="true" />
          {channels[row.channel as keyof typeof channels] ?? row.channel}
        </p>
        <p className="text-muted-foreground">
          {new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            dateStyle: "short",
          }).format(row.contactedAt)}{" "}
          · {row.author}
        </p>
      </div>
      <p className="text-sm leading-relaxed text-foreground">{row.notes}</p>
      {row.nextContactDate && (
        <p className="text-caption text-muted-foreground">
          Retorno combinado: {formatDateOnlyBR(row.nextContactDate)}
        </p>
      )}
    </article>
  );
}
