"use client";
import { useState, type ReactElement } from "react";
import { CalendarDays, MessageSquarePlus, UserRound } from "lucide-react";
import { Badge, Button } from "@lazuli/ui";
import { LeadContactDialog } from "./lead-contact-dialog";
import { LeadNextStepDialog } from "./lead-next-step-dialog";
import { dateLabel, dateOnly, type Candidate } from "./labels";

export function LeadFollowUp({ candidate }: { candidate: Candidate }): ReactElement {
  const [dialog, setDialog] = useState<"step" | "contact" | null>(null);
  return (
    <section
      className="grid gap-5 rounded-lg border border-border bg-card p-4 sm:p-5"
      aria-label="Acompanhamento comercial"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-h3 font-semibold">Acompanhamento</h2>
          <p className="mt-1 text-caption text-muted-foreground">
            O próximo contato e o que já foi conversado.
          </p>
        </div>
        {candidate.status === "WAITING" && (
          <Button size="compact-responsive" onClick={() => setDialog("contact")}>
            <MessageSquarePlus />
            Registrar contato
          </Button>
        )}
      </div>
      <NextStep candidate={candidate} onEdit={() => setDialog("step")} />
      <ContactHistory candidate={candidate} />
      {dialog === "step" && (
        <LeadNextStepDialog candidate={candidate} onClose={() => setDialog(null)} />
      )}
      {dialog === "contact" && (
        <LeadContactDialog candidate={candidate} onClose={() => setDialog(null)} />
      )}
    </section>
  );
}
function NextStep({
  candidate,
  onEdit,
}: {
  candidate: Candidate;
  onEdit: () => void;
}): ReactElement {
  const date = dateOnly(candidate.nextActionOn);
  const overdue = date && date < candidate.today && candidate.status === "WAITING";
  return (
    <div className="grid gap-3 border-y border-border py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-muted-foreground">Próximo passo</span>
          {overdue && <Badge variant="warning">Retorno em atraso</Badge>}
        </div>
        <p className="break-words font-medium">
          {candidate.nextAction ??
            (candidate.status === "WAITING" ? "Ainda não definido" : "Acompanhamento encerrado")}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-muted-foreground">
          {date && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {date === candidate.today ? "Hoje" : dateLabel(date)}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <UserRound className="size-3.5" />
            {candidate.owner?.name ?? "Sem responsável"}
          </span>
        </div>
      </div>
      {candidate.status === "WAITING" && (
        <Button variant="secondary" size="sm" onClick={onEdit}>
          {candidate.nextAction ? "Editar próximo passo" : "Definir próximo passo"}
        </Button>
      )}
    </div>
  );
}
function ContactHistory({ candidate }: { candidate: Candidate }): ReactElement {
  return (
    <div className="grid gap-3">
      <h3 className="text-caption font-semibold">Histórico de contatos</h3>
      {candidate.contacts.length === 0 ? (
        <p className="text-caption text-muted-foreground">Nenhum contato registrado ainda.</p>
      ) : (
        <ol className="divide-y divide-border">
          {candidate.contacts.map((contact) => (
            <li key={contact.id} className="grid gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
                <time dateTime={dateOnly(contact.contactedOn)}>
                  {dateLabel(contact.contactedOn)}
                </time>
                <span>· {contact.recordedBy.name}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-caption">{contact.summary}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
