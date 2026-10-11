"use client";
import Link from "next/link";
import { useState, type ReactElement } from "react";
import { Badge, Button } from "@lazuli/ui";
import { Link2, Plus } from "lucide-react";
import { trpc } from "~/lib/trpc";
import {
  BackLink,
  CATEGORY,
  dateLabel,
  FollowUpTimeline,
  OccurrenceLink,
  QueryState,
  recordedLabel,
  StatusBadge,
  type Occurrence,
} from "./shared";
import { InterventionForm } from "./intervention-form";
import { OccurrenceNoteForm } from "./action-forms";
import { LinkOccurrenceForm } from "./link-form";
export function OccurrenceDetail({ id }: { id: string }): ReactElement {
  const query = trpc.occurrences.byId.useQuery({ id });
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-5 p-4 sm:p-6">
        <BackLink />
        <QueryState
          pending={query.isPending}
          error={query.error}
          retry={() => void query.refetch()}
        />
        {query.data && <OccurrenceContent row={query.data} />}
      </div>
    </div>
  );
}
function OccurrenceContent({ row }: { row: Occurrence }): ReactElement {
  const [action, setAction] = useState<"note" | "link" | "intervention" | null>(null);
  return (
    <>
      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-caption font-semibold text-interactive">
            {row.student.fullName}
          </span>
          <Badge variant="muted">{CATEGORY[row.category]}</Badge>
        </div>
        <h1 className="max-w-3xl break-words font-display text-h2 font-semibold text-heading">
          {row.title}
        </h1>
        <p className="text-caption text-muted-foreground">
          Aula de {dateLabel(row.classSession.date)} · {row.classSession.class.portalClassName}
        </p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 gap-6">
          <article className="grid gap-6 rounded-lg border border-border bg-card p-5 sm:p-6">
            <section className="grid gap-3">
              <h2 className="text-micro font-semibold uppercase tracking-label text-muted-foreground">
                Relato
              </h2>
              <p className="whitespace-pre-wrap break-words text-base leading-relaxed">
                {row.account}
              </p>
            </section>
            {row.initialResponse && (
              <section className="grid gap-3 border-t border-border pt-5">
                <h2 className="text-micro font-semibold uppercase tracking-label text-muted-foreground">
                  Resposta inicial
                </h2>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {row.initialResponse}
                </p>
              </section>
            )}
            <p className="border-t border-border pt-4 text-caption text-muted-foreground">
              Registrado por {row.recordedBy.name} · {recordedLabel(row.createdAt)}
            </p>
          </article>
          <section className="grid gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Complementos do relato</h2>
              <Button
                variant="secondary"
                size="compact-responsive"
                onClick={() => setAction("note")}
              >
                <Plus />
                Complementar
              </Button>
            </div>
            {row.followUps.length ? (
              <FollowUpTimeline rows={row.followUps} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Novas informações e correções ficam registradas aqui, com data e autoria.
              </p>
            )}
          </section>
        </div>
        <aside className="grid gap-6">
          <section className="grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Ocorrências relacionadas</h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Relacionar ocorrência"
                onClick={() => setAction("link")}
              >
                <Link2 />
              </Button>
            </div>
            {row.related.map((related) => (
              <OccurrenceLink key={related.id} row={related} />
            ))}
            {!row.related.length && (
              <p className="text-caption text-muted-foreground">
                Conecte relatos que ajudem a entender este contexto.
              </p>
            )}
          </section>
          <section className="grid gap-3 border-t border-border pt-5">
            <h2 className="text-sm font-semibold">Intervenções</h2>
            {row.interventions.map((intervention) => (
              <Link
                key={intervention.id}
                href={`/acompanhamento/intervencoes/${intervention.id}`}
                className="grid gap-2 rounded-md border border-border p-4 hover:border-border-strong"
              >
                <StatusBadge status={intervention.status} />
                <span className="text-sm font-medium text-heading">{intervention.title}</span>
                <span className="text-caption text-muted-foreground">
                  {intervention.teacher.name}
                </span>
              </Link>
            ))}
            {!row.interventions.length && !row.canOrganize && (
              <p className="text-caption text-muted-foreground">
                Nenhuma intervenção vinculada a este relato.
              </p>
            )}
            {row.canOrganize && (
              <>
                <p className="text-caption text-muted-foreground">
                  Uma série de ocorrências pode precisar da atuação de um professor.
                </p>
                <Button size="compact-responsive" onClick={() => setAction("intervention")}>
                  Organizar intervenção
                </Button>
              </>
            )}
          </section>
        </aside>
      </div>
      {action === "note" && <OccurrenceNoteForm id={row.id} onClose={() => setAction(null)} />}
      {action === "intervention" && (
        <InterventionForm source={row} onClose={() => setAction(null)} />
      )}
      {action === "link" && (
        <LinkOccurrenceForm
          studentId={row.studentId}
          target={{ type: "occurrence", id: row.id }}
          exclude={[row.id, ...row.related.map((item) => item.id)]}
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
}
