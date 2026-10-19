"use client";
import { useState, type ReactElement } from "react";
import { ArrowUpRight, CalendarDays, MoreHorizontal } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@lazuli/ui";
import { PlacementVisitDialog } from "./placement-assessment";
import { VisitDialog } from "./visit-dialog";
import { OutcomeDialog } from "./visit-outcome";
import { dateLabel, formatLabel, visitLabels, type Candidate } from "./labels";

type Visit = Candidate["visits"][number];
type VisitAction = { kind: "outcome" | "cancel" | "reschedule"; visit: Visit };
type VisitRowProps = {
  visit: Visit;
  canReschedule: boolean;
  onAction: (action: VisitAction) => void;
};
export function CandidateVisits({ candidate }: { candidate: Candidate }): ReactElement {
  const [action, setAction] = useState<VisitAction | null>(null);
  const [placementId, setPlacementId] = useState<string | null>(null);
  const visits = [...candidate.visits].sort((a, b) => {
    const status = Number(b.status === "SCHEDULED") - Number(a.status === "SCHEDULED");
    const time = a.date.getTime() - b.date.getTime() || a.startTime.localeCompare(b.startTime);
    return status || (a.status === "SCHEDULED" ? time : -time);
  });
  return (
    <>
      {visits.length === 0 ? (
        <EmptyVisits />
      ) : (
        <ol className="divide-y divide-border">
          {visits.map((visit) =>
            visit.kind === "PLACEMENT" ? (
              <li
                key={visit.id}
                className="flex items-center justify-between gap-4 py-4 first:pt-0"
              >
                <div className="grid gap-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">Nivelamento</h3>
                    <Badge variant={visit.assessment?.stageId ? "success" : "neutral"}>
                      {visit.status === "CANCELLED"
                        ? "Cancelado"
                        : visit.status === "ABSENT"
                          ? "Não compareceu"
                          : visit.assessment?.stageId
                            ? "Estágio definido"
                            : visit.assessment
                              ? "Aguardando correção"
                              : visitLabels[visit.status]}
                    </Badge>
                  </div>
                  <p className="font-numeric text-caption">
                    {dateLabel(visit.date)} · {visit.startTime}–{visit.endTime} ·{" "}
                    {formatLabel(visit.format)}
                  </p>
                  {visit.assessment?.stage && (
                    <p className="text-caption text-muted-foreground">
                      {visit.assessment.stage.name}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPlacementId(visit.id)}>
                  Abrir atendimento
                  <ArrowUpRight />
                </Button>
              </li>
            ) : (
              <VisitRow
                key={visit.id}
                visit={visit}
                canReschedule={candidate.status === "WAITING"}
                onAction={setAction}
              />
            ),
          )}
        </ol>
      )}
      {placementId && (
        <PlacementVisitDialog
          candidateId={candidate.id}
          visitId={placementId}
          onClose={() => setPlacementId(null)}
        />
      )}
      {action && (
        <VisitActionDialog action={action} candidate={candidate} onClose={() => setAction(null)} />
      )}
    </>
  );
}
function EmptyVisits(): ReactElement {
  return (
    <div className="flex gap-3 py-4">
      <CalendarDays className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div className="grid gap-1">
        <p className="font-medium">Nenhum agendamento</p>
        <p className="text-caption text-muted-foreground">
          A experimental é uma oportunidade de conhecer a escola antes de decidir pela matrícula.
        </p>
      </div>
    </div>
  );
}
function VisitRow(props: VisitRowProps): ReactElement {
  const { visit } = props;
  return (
    <li className="grid gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <VisitSummary visit={visit} />
        {visit.status !== "CANCELLED" && <VisitActions {...props} />}
      </div>
      {visit.needsReschedule && (
        <Alert variant="warning">
          O encontro da turma mudou ou está sem professor. Remarque esta aula experimental.
        </Alert>
      )}
      {visit.notes && (
        <p className="break-words text-caption text-muted-foreground">{visit.notes}</p>
      )}
      {visit.cancellationReason && (
        <p className="text-caption text-muted-foreground">{visit.cancellationReason}</p>
      )}
    </li>
  );
}
function VisitSummary({ visit }: { visit: Visit }): ReactElement {
  const variants = {
    ATTENDED: "success",
    ABSENT: "warning",
    SCHEDULED: "neutral",
    CANCELLED: "neutral",
  } as const;
  return (
    <div className="grid min-w-0 gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">Aula experimental</h3>
        <Badge variant={variants[visit.status]}>{visitLabels[visit.status]}</Badge>
        {visit.previousVisitId && (
          <span className="text-caption text-muted-foreground">Remarcada</span>
        )}
      </div>
      <p className="font-numeric text-caption">
        {visit.kind === "TRIAL" ? "Em uma turma" : "Individual"} · {dateLabel(visit.date)} ·{" "}
        {visit.startTime}–{visit.endTime}
      </p>
      <p className="text-caption text-muted-foreground">
        {visit.teacherName ?? "Professor a definir"}
        {visit.class ? ` · ${visit.class.portalClassName}` : ""}
      </p>
    </div>
  );
}
function VisitActions({ visit, canReschedule, onAction }: VisitRowProps): ReactElement {
  const actions: { kind: VisitAction["kind"]; label: string; visible: boolean }[] = [
    { kind: "outcome", label: "Registrar comparecimento", visible: true },
    {
      kind: "reschedule",
      label: "Remarcar",
      visible: canReschedule && visit.status === "SCHEDULED",
    },
    { kind: "cancel", label: "Cancelar aula", visible: true },
  ];
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-compact-responsive"
            aria-label={`Ações da aula de ${dateLabel(visit.date)} às ${visit.startTime}`}
          />
        }
      >
        <MoreHorizontal />
      </PopoverTrigger>
      <PopoverContent align="end">
        <div className="grid gap-1">
          {actions
            .filter((action) => action.visible)
            .map((action) => (
              <PopoverClose
                key={action.kind}
                render={<Button variant="ghost" size="sm" />}
                onClick={() => onAction({ kind: action.kind, visit })}
              >
                {action.label}
              </PopoverClose>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
function VisitActionDialog({
  action,
  candidate,
  onClose,
}: {
  action: VisitAction;
  candidate: Candidate;
  onClose: () => void;
}): ReactElement {
  if (action.kind === "reschedule")
    return (
      <VisitDialog candidate={candidate} previousVisitId={action.visit.id} onClose={onClose} />
    );
  return <OutcomeDialog visit={action.visit} cancel={action.kind === "cancel"} onClose={onClose} />;
}
