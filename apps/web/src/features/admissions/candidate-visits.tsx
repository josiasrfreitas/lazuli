"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  FileCheck2,
  FileUp,
  MapPin,
  MoreHorizontal,
  UserRound,
  Video,
} from "lucide-react";
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
import { dateLabel, dateOnly, visitLabels, type Candidate } from "./labels";
import { placementHasStarted, placementStatus } from "./placement-state";
import styles from "./lead-workspace.module.css";

type Visit = Candidate["visits"][number];
type VisitAction = { kind: "outcome" | "cancel" | "reschedule"; visit: Visit };
const variants = {
  ATTENDED: "success",
  ABSENT: "warning",
  SCHEDULED: "neutral",
  CANCELLED: "neutral",
} as const;

export function CandidateVisits({ candidate }: { candidate: Candidate }) {
  const [action, setAction] = useState<VisitAction | null>(null);
  const [placement, setPlacement] = useState<{ id: string; upload: boolean } | null>(null);
  const visits = [...candidate.visits].sort((a, b) => {
    const status = Number(b.status === "SCHEDULED") - Number(a.status === "SCHEDULED");
    const time = a.date.getTime() - b.date.getTime() || a.startTime.localeCompare(b.startTime);
    return status || (a.status === "SCHEDULED" ? time : -time);
  });
  return (
    <>
      {!visits.length ? (
        <div className={styles.empty}>
          <CalendarDays aria-hidden="true" />
          <h3>
            {candidate.status === "WAITING"
              ? "O primeiro encontro começa aqui"
              : "Nenhum agendamento"}
          </h3>
          <p>
            {candidate.status === "WAITING"
              ? candidate.englishExperience === "SOME"
                ? "Agende o nivelamento para definir o estágio ou uma experimental para conhecer a escola."
                : "Agende uma experimental para conhecer a escola. Os encontros e registros aparecerão aqui."
              : "Este lead não possui agendamentos registrados."}
          </p>
        </div>
      ) : (
        <ol className={styles.events}>
          {visits.map((visit) => {
            const isPlacement = visit.kind === "PLACEMENT";
            const status = isPlacement
              ? placementStatus(visit)
              : { label: visitLabels[visit.status], variant: variants[visit.status] };
            const canUpload =
              candidate.status === "WAITING" &&
              !visit.assessment &&
              !["CANCELLED", "ABSENT"].includes(visit.status) &&
              placementHasStarted(visit);
            const actionLabel = canUpload
              ? "Anexar prova"
              : visit.assessment?.stageId
                ? "Ver resultado"
                : visit.assessment && candidate.status === "WAITING"
                  ? "Corrigir prova"
                  : "Abrir atendimento";
            return (
              <li
                className={styles.event}
                key={visit.id}
                data-inactive={visit.status === "CANCELLED" || undefined}
              >
                <div className={styles.eventMain}>
                  <EventDate visit={visit} />
                  <div className={styles.eventContent}>
                    <div className={styles.eventHeading}>
                      <h3>{isPlacement ? "Nivelamento" : "Aula experimental"}</h3>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <div className={styles.eventMeta}>
                      <span>
                        <Clock3 aria-hidden="true" />
                        {visit.startTime}–{visit.endTime}
                      </span>
                      <span>
                        {visit.format === "ONLINE" ? (
                          <Video aria-hidden="true" />
                        ) : (
                          <MapPin aria-hidden="true" />
                        )}
                        {visit.format === "ONLINE" ? "Online" : "Presencial"}
                      </span>
                    </div>
                    <p className={styles.teacher}>
                      <UserRound aria-hidden="true" />
                      {visit.teacherName ?? "Professor a definir"}
                    </p>
                    {!isPlacement && (
                      <p className={styles.eventDetail}>
                        {visit.kind === "TRIAL"
                          ? (visit.class?.portalClassName ?? "Em turma")
                          : "Encontro individual"}
                        {visit.previousVisitId && " · Remarcada"}
                      </p>
                    )}
                  </div>
                  {!isPlacement && visit.status !== "CANCELLED" && (
                    <VisitMenu
                      visit={visit}
                      canReschedule={candidate.status === "WAITING"}
                      onAction={setAction}
                    />
                  )}
                </div>
                {visit.needsReschedule && (
                  <Alert variant="warning">
                    O encontro mudou ou ficou sem professor. Remarque esta experimental.
                  </Alert>
                )}
                {visit.notes && <p className={styles.eventNotes}>{visit.notes}</p>}
                {visit.cancellationReason && (
                  <p className={styles.eventNotes}>{visit.cancellationReason}</p>
                )}
                <div className={styles.eventFooter}>
                  <EventNextStep visit={visit} />
                  {isPlacement ? (
                    <Button
                      variant="secondary"
                      size="compact-responsive"
                      onClick={() => setPlacement({ id: visit.id, upload: canUpload })}
                    >
                      {canUpload ? <FileUp /> : <ArrowUpRight />}
                      {actionLabel}
                    </Button>
                  ) : (
                    visit.status !== "CANCELLED" && (
                      <Button
                        variant="ghost"
                        size="compact-responsive"
                        onClick={() => setAction({ kind: "outcome", visit })}
                      >
                        {visit.status === "SCHEDULED" ? "Registrar comparecimento" : "Ver registro"}
                        <ArrowUpRight />
                      </Button>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {placement && (
        <PlacementVisitDialog
          candidateId={candidate.id}
          visitId={placement.id}
          initialUpload={placement.upload}
          onClose={() => setPlacement(null)}
        />
      )}
      {action?.kind === "reschedule" ? (
        <VisitDialog
          candidate={candidate}
          previousVisitId={action.visit.id}
          onClose={() => setAction(null)}
        />
      ) : (
        action && (
          <OutcomeDialog
            visit={action.visit}
            cancel={action.kind === "cancel"}
            onClose={() => setAction(null)}
          />
        )
      )}
    </>
  );
}

function EventNextStep({ visit }: { visit: Visit }) {
  if (visit.status === "CANCELLED") return <p>Agendamento encerrado.</p>;
  if (visit.status === "ABSENT") return <p>O lead não compareceu.</p>;
  if (visit.kind !== "PLACEMENT")
    return (
      <p>
        {visit.status === "ATTENDED"
          ? "Comparecimento registrado."
          : "Registre a participação após o encontro."}
      </p>
    );
  if (visit.assessment?.stage)
    return (
      <p>
        <FileCheck2 aria-hidden="true" />
        {visit.assessment.stage.name}
      </p>
    );
  return (
    <p>
      {visit.assessment
        ? "Prova anexada. Falta registrar o estágio."
        : "A prova e a correção definem o estágio."}
    </p>
  );
}

function EventDate({ visit }: { visit: Visit }) {
  return (
    <time
      className={styles.eventDate}
      dateTime={dateOnly(visit.date)}
      aria-label={dateLabel(visit.date)}
    >
      <span>
        {new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
          .format(visit.date)
          .replace(".", "")}
      </span>
      <strong>{String(visit.date.getUTCDate()).padStart(2, "0")}</strong>
      <span>
        {new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" })
          .format(visit.date)
          .replace(".", "")}
      </span>
    </time>
  );
}

function VisitMenu({
  visit,
  canReschedule,
  onAction,
}: {
  visit: Visit;
  canReschedule: boolean;
  onAction: (action: VisitAction) => void;
}) {
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
          {canReschedule && visit.status === "SCHEDULED" && (
            <PopoverClose
              render={<Button variant="ghost" size="sm" />}
              onClick={() => onAction({ kind: "reschedule", visit })}
            >
              Remarcar
            </PopoverClose>
          )}
          <PopoverClose
            render={<Button variant="destructive-ghost" size="sm" />}
            onClick={() => onAction({ kind: "cancel", visit })}
          >
            Cancelar aula
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
