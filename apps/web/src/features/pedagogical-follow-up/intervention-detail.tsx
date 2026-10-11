"use client";
import { useState, type ReactElement } from "react";
import type { InterventionUpdate } from "@lazuli/validators";
import { Badge, Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import {
  BackLink,
  dateLabel,
  FollowUpTimeline,
  OccurrenceLink,
  QueryState,
  recordedLabel,
  StatusBadge,
  type Intervention,
} from "./shared";
import { InterventionUpdateForm } from "./action-forms";
import { LinkOccurrenceForm } from "./link-form";
export function InterventionDetail({ id }: { id: string }): ReactElement {
  const query = trpc.interventions.byId.useQuery({ id });
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-5 p-4 sm:p-6">
        <BackLink />
        <QueryState
          pending={query.isPending}
          error={query.error}
          retry={() => void query.refetch()}
        />
        {query.data && <InterventionContent row={query.data} />}
      </div>
    </div>
  );
}
function InterventionContent({ row }: { row: Intervention }): ReactElement {
  const [action, setAction] = useState<InterventionUpdate["kind"] | "LINK" | null>(null);
  const closed = row.status === "CONCLUDED";
  const overdue = !closed && row.dueOn && row.dueOn.toISOString().slice(0, 10) < row.today;
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-caption font-semibold text-interactive">
              {row.student.fullName}
            </span>
            <StatusBadge status={row.status} />
            {overdue && <Badge variant="warning">Prazo vencido</Badge>}
          </div>
          <h1 className="max-w-3xl break-words font-display text-h2 font-semibold text-heading">
            {row.title}
          </h1>
          <p className="text-caption text-muted-foreground">
            Professor responsável · {row.teacher.name}
          </p>
        </div>
        <Button size="compact-responsive" onClick={() => setAction(closed ? "REOPEN" : "NOTE")}>
          {closed ? "Reabrir intervenção" : "Registrar acompanhamento"}
        </Button>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 gap-7">
          <article className="grid gap-5 rounded-lg border border-border bg-card p-5 sm:p-6">
            <section className="grid gap-3">
              <h2 className="text-micro font-semibold uppercase tracking-label text-muted-foreground">
                Objetivo da atuação
              </h2>
              <p className="whitespace-pre-wrap break-words text-base leading-relaxed">
                {row.objective}
              </p>
            </section>
            <section className="grid gap-3 border-t border-border pt-5">
              <h2 className="text-micro font-semibold uppercase tracking-label text-muted-foreground">
                {closed ? "Resultado observado" : "Próximo passo"}
              </h2>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {closed ? row.outcome : row.nextStep}
              </p>
              <p className="text-caption text-muted-foreground">
                {closed && row.concludedAt
                  ? `Concluída em ${recordedLabel(row.concludedAt)}`
                  : row.dueOn
                    ? `Prazo combinado: ${dateLabel(row.dueOn)}`
                    : "Sem prazo definido"}
              </p>
            </section>
            {!closed && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {row.status === "OPEN" && (
                  <Button
                    variant="secondary"
                    size="compact-responsive"
                    onClick={() => setAction("START")}
                  >
                    Iniciar atuação
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="compact-responsive"
                  onClick={() => setAction("CONCLUDE")}
                >
                  Concluir intervenção
                </Button>
                {row.canOrganize && (
                  <Button
                    variant="ghost"
                    size="compact-responsive"
                    onClick={() => setAction("ASSIGN")}
                  >
                    Alterar responsável
                  </Button>
                )}
              </div>
            )}
          </article>
          <section className="grid gap-5">
            <h2 className="text-lg font-semibold">Histórico de acompanhamento</h2>
            <div className="grid gap-2 border-l-2 border-border pl-4">
              <p className="text-caption font-semibold">Intervenção aberta</p>
              <p className="text-caption text-muted-foreground">
                {row.recordedBy.name} · {recordedLabel(row.createdAt)}
              </p>
            </div>
            <FollowUpTimeline rows={row.followUps} />
          </section>
        </div>
        <aside className="grid gap-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Ocorrências motivadoras</h2>
            <span className="font-numeric text-caption text-muted-foreground">
              {row.occurrences.length}
            </span>
          </div>
          {row.occurrences.map((occurrence) => (
            <OccurrenceLink key={occurrence.id} row={occurrence} />
          ))}
          {row.canOrganize && !closed && (
            <Button variant="secondary" size="compact-responsive" onClick={() => setAction("LINK")}>
              Incluir ocorrência
            </Button>
          )}
        </aside>
      </div>
      {action && action !== "LINK" && (
        <InterventionUpdateForm row={row} kind={action} onClose={() => setAction(null)} />
      )}
      {action === "LINK" && (
        <LinkOccurrenceForm
          studentId={row.studentId}
          target={{ type: "intervention", id: row.id, version: row.version }}
          exclude={row.occurrences.map((item) => item.id)}
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
}
