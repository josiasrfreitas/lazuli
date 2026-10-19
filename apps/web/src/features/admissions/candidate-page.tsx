"use client";

import { useState, type ReactElement } from "react";
import { Archive, CalendarDays, MoreHorizontal, Pencil, RotateCcw } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  DetailFact,
  DetailFacts,
  DetailHeader,
  InlineSkeleton,
  PencilLoader,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { toWhatsAppUrl } from "~/lib/format";
import { LeadCaptureDialog } from "./lead-capture-dialog";
import { LeadEnrollment } from "./lead-enrollment";
import { CandidateVisits } from "./candidate-visits";
import { PlacementSchedule } from "./placement-schedule";
import { VisitDialog } from "./visit-dialog";
import { dateLabel, formatLabel, leadInterestLabels, statusLabels, type Candidate } from "./labels";

const pageClass = "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8";

export function CandidatePage({ id }: { id: string }): ReactElement {
  const query = trpc.admissions.byId.useQuery({ id }, { retry: false });
  return (
    <div data-page-scroll="internal" className="flex h-full min-h-0 flex-col">
      {query.isPending ? (
        <CandidateLoading />
      ) : query.data ? (
        <CandidateWorkspace candidate={query.data} />
      ) : (
        <div className="p-6">
          <Alert variant="destructive">
            {query.error?.message ?? "Não foi possível abrir o lead."}
            <Button variant="secondary" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          </Alert>
        </div>
      )}
    </div>
  );
}

function CandidateWorkspace({ candidate }: { candidate: Candidate }): ReactElement {
  const [dialog, setDialog] = useState<"edit" | "trial" | "placement" | null>(null);
  const utils = trpc.useUtils();
  const status = trpc.admissions.setStatus.useMutation({
    onSuccess: () => utils.admissions.invalidate(),
  });
  const active = candidate.status === "WAITING";
  const hasPlacement = candidate.visits.some(
    (visit) => visit.kind === "PLACEMENT" && visit.status === "SCHEDULED",
  );
  return (
    <div className={pageClass}>
      <div className="shrink-0">
        <DetailHeader
          title={candidate.fullName}
          metadata={
            <Badge variant={candidate.status === "ENROLLED" ? "success" : "neutral"}>
              {statusLabels[candidate.status]}
            </Badge>
          }
          actions={
            <div className="flex items-center gap-2">
              {active && (
                <Button variant="secondary" size="sm" onClick={() => setDialog("trial")}>
                  <CalendarDays />
                  Agendar experimental
                </Button>
              )}
              <LeadEnrollment candidate={candidate} />
              <Popover>
                <PopoverTrigger
                  render={<Button variant="ghost" size="icon" aria-label="Mais ações do lead" />}
                >
                  <MoreHorizontal />
                </PopoverTrigger>
                <PopoverContent align="end">
                  <div className="grid gap-1">
                    {active && (
                      <PopoverClose
                        render={<Button variant="ghost" size="sm" />}
                        onClick={() => setDialog("edit")}
                      >
                        <Pencil />
                        Editar lead
                      </PopoverClose>
                    )}
                    {candidate.status !== "ENROLLED" && (
                      <PopoverClose
                        render={<Button variant="ghost" size="sm" />}
                        disabled={status.isPending}
                        onClick={() =>
                          status.mutate({
                            id: candidate.id,
                            status: active ? "ARCHIVED" : "WAITING",
                          })
                        }
                      >
                        {active ? <Archive /> : <RotateCcw />}
                        {active ? "Arquivar lead" : "Reabrir lead"}
                      </PopoverClose>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          }
        />
        {status.error && (
          <Alert variant="destructive" className="mt-3">
            {status.error.message}
          </Alert>
        )}
      </div>
      <section
        aria-label="Dados do lead"
        className="grid shrink-0 gap-4 rounded-lg bg-muted/40 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <CandidateContact candidate={candidate} />
          {active && (
            <Button variant="ghost" size="sm" onClick={() => setDialog("edit")}>
              <Pencil />
              Editar dados
            </Button>
          )}
        </div>
        <DetailFacts layout="columns">
          <DetailFact label="Interesse">{leadInterestLabels[candidate.interest]}</DetailFact>
          <DetailFact label="Estágio">
            {candidate.stage?.name ??
              (candidate.englishExperience === "SOME" ? "Nivelamento pendente" : "A definir")}
          </DetailFact>
          <DetailFact label="Preferência de formato">
            {candidate.format ? formatLabel(candidate.format) : "Sem preferência"}
          </DetailFact>
          <DetailFact label="Origem">{candidate.source || "Não informada"}</DetailFact>
        </DetailFacts>
        {candidate.notes && (
          <p className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-caption text-muted-foreground">
            {candidate.notes}
          </p>
        )}
      </section>
      <section aria-label="Agendamentos do lead" className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-xl font-medium text-heading">Agendamentos</h2>
            <span className="text-caption text-muted-foreground">{candidate.visits.length}</span>
          </div>
          {active && candidate.englishExperience === "SOME" && !hasPlacement && (
            <Button variant="secondary" size="sm" onClick={() => setDialog("placement")}>
              <CalendarDays />
              Agendar nivelamento
            </Button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CandidateVisits candidate={candidate} />
        </div>
      </section>
      <p className="shrink-0 text-caption text-muted-foreground">
        Lead cadastrado em {dateLabel(candidate.createdAt)}
      </p>
      {dialog === "edit" && (
        <LeadCaptureDialog candidate={candidate} onClose={() => setDialog(null)} />
      )}
      {dialog === "trial" && <VisitDialog candidate={candidate} onClose={() => setDialog(null)} />}
      {dialog === "placement" && (
        <PlacementSchedule candidate={candidate} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function CandidateContact({ candidate }: { candidate: Candidate }): ReactElement {
  const whatsapp = toWhatsAppUrl(candidate.phone);
  return (
    <DetailFacts>
      {candidate.contactName && (
        <DetailFact label={candidate.contactRole === "GUARDIAN" ? "Responsável" : "Contato"}>
          {candidate.contactName}
        </DetailFact>
      )}
      {candidate.birthDate && (
        <DetailFact label="Nascimento">{dateLabel(candidate.birthDate)}</DetailFact>
      )}
      {candidate.phone && (
        <DetailFact
          label={candidate.contactOwner === "GUARDIAN" ? "Telefone do responsável" : "Telefone"}
        >
          <a
            className="text-interactive hover:underline"
            href={whatsapp ?? `tel:${candidate.phone}`}
            target={whatsapp ? "_blank" : undefined}
            rel="noreferrer"
          >
            {candidate.phone}
          </a>
        </DetailFact>
      )}
      {candidate.email && (
        <DetailFact
          label={candidate.contactOwner === "GUARDIAN" ? "E-mail do responsável" : "E-mail"}
        >
          <a
            className="break-all text-interactive hover:underline"
            href={`mailto:${candidate.email}`}
          >
            {candidate.email}
          </a>
        </DetailFact>
      )}
    </DetailFacts>
  );
}

function CandidateLoading(): ReactElement {
  return (
    <div className={pageClass} aria-busy="true" aria-label="Carregando lead">
      <DetailHeader
        title={<InlineSkeleton className="h-8 w-72" />}
        metadata={<InlineSkeleton className="h-5 w-16" />}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled>
              <CalendarDays />
              Agendar experimental
            </Button>
            <Button size="sm" disabled>
              Cadastrar aluno
            </Button>
          </div>
        }
      />
      <section className="grid gap-4 rounded-lg bg-muted/40 p-4" aria-hidden="true">
        <div className="flex gap-6 border-b border-border pb-3">
          <InlineSkeleton className="h-5 w-48" />
          <InlineSkeleton className="h-5 w-52" />
        </div>
        <DetailFacts layout="columns">
          {["Interesse", "Estágio", "Preferência de formato", "Origem"].map((label) => (
            <DetailFact key={label} label={label}>
              <InlineSkeleton className="h-5 w-28" />
            </DetailFact>
          ))}
        </DetailFacts>
      </section>
      <section className="grid gap-4">
        <h2 className="border-b border-border pb-3 font-display text-xl font-medium text-heading">
          Agendamentos
        </h2>
        <PencilLoader size="sm" label="Carregando agendamentos" />
      </section>
    </div>
  );
}
