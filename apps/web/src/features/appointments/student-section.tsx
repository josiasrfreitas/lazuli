"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { RecordState } from "~/features/class-records/shared";
import { AbsenceContactDialog } from "./contact-dialog";
import { AppointmentBadge, channels, monthBounds, purposes, shiftMonth, today } from "./shared";

export function StudentAppointments({ studentId }: { studentId: string }) {
  const [contacting, setContacting] = useState(false);
  const month = today().slice(0, 7);
  const range = {
    from: monthBounds(shiftMonth(month, -1)).from,
    through: monthBounds(shiftMonth(month, 1)).through,
  };
  const agenda = trpc.appointments.list.useQuery({ ...range, studentId });
  const student = trpc.appointments.student.useQuery({ studentId });
  const rows = [...(agenda.data ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const contacts = student.data?.contacts ?? [];
  return (
    <section className="grid gap-5 rounded-md border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Atendimentos e frequência</h2>
          <p className="mt-1 text-caption text-muted-foreground">
            Reposições e apoio pedagógico · {formatDateOnlyBR(range.from)} a{" "}
            {formatDateOnlyBR(range.through)}
          </p>
        </div>
        <Button
          variant="secondary"
          size="compact-responsive"
          nativeButton={false}
          render={<Link href={`/atendimentos?aluno=${studentId}`} />}
        >
          Ver agenda
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
      <div className="divide-y divide-border">
        {rows.slice(0, 5).map((row) => (
          <Link
            key={row.id}
            href={`/atendimentos/${row.id}`}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <div>
              <h3 className="text-sm font-medium">{purposes[row.purpose]}</h3>
              <p className="mt-1 text-caption text-muted-foreground">
                {formatDateOnlyBR(row.date)} · {row.startTime} ·{" "}
                {row.teacher?.name ?? "Professor a definir"}
              </p>
            </div>
            <AppointmentBadge status={row.status} overdue={row.overdue} />
          </Link>
        ))}
        {agenda.data && !rows.length && (
          <p className="text-sm text-muted-foreground">Nenhum atendimento neste período.</p>
        )}
      </div>
      <div className="grid gap-4 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Contatos sobre frequência</h3>
          <Button
            variant="ghost"
            size="sm"
            disabled={!student.data}
            onClick={() => setContacting(true)}
          >
            Registrar contato
          </Button>
        </div>
        {contacts.slice(0, 5).map((row) => (
          <article key={row.id} className="grid gap-1 border-l-2 border-border pl-3">
            <p className="text-caption text-muted-foreground">
              {new Intl.DateTimeFormat("pt-BR", {
                timeZone: "America/Sao_Paulo",
                dateStyle: "short",
                timeStyle: "short",
              }).format(row.contactedAt)}{" "}
              · {channels[row.channel as keyof typeof channels] ?? row.channel} · {row.author}
            </p>
            <p className="text-sm">{row.notes}</p>
            {row.nextContactDate && (
              <p className="text-caption text-muted-foreground">
                Próximo contato: {formatDateOnlyBR(row.nextContactDate)}
              </p>
            )}
          </article>
        ))}
        {student.data && !contacts.length && (
          <p className="text-caption text-muted-foreground">Nenhum contato registrado.</p>
        )}
        {contacts.length > 5 && (
          <details>
            <summary className="cursor-pointer text-caption text-interactive">
              Ver mais {contacts.length - 5} contatos
            </summary>
            <div className="mt-4 grid gap-4">
              {contacts.slice(5).map((row) => (
                <article key={row.id} className="grid gap-1 border-l-2 border-border pl-3">
                  <p className="text-caption text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(row.contactedAt)}{" "}
                    · {row.author}
                  </p>
                  <p className="text-sm">{row.notes}</p>
                </article>
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
