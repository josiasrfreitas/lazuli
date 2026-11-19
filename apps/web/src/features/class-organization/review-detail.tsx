"use client";

import type { ReactElement, ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, TriangleAlert, Undo2 } from "lucide-react";
import { hasFormationSignal, followsOwnClass } from "@lazuli/domain";
import { Button } from "@lazuli/ui";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { responseLabels } from "./confirmation";
import type { ClassPlan, OrganizationAction, OrganizationBoard, Placement } from "./model";
import { CaseTimeline } from "./case-timeline";
import { reviewClassHeading } from "./review-class-heading";
import { ReviewFollowUps, ReviewMetrics, ReviewPending, type ProfileLinks } from "./review-context";
import {
  isReviewDeparture,
  needsReviewDestination,
  reviewDestinationId,
  reviewPlanName,
} from "./review-group-model";
import { reviewEffectiveDate, reviewStatus } from "./review-model";
import { dateOnly, modes } from "./shared";
import styles from "./review-detail.module.css";

type Props = {
  row: Placement;
  board: OrganizationBoard;
  onAction: (action: OrganizationAction) => void;
  readOnly?: boolean;
  children?: ReactNode;
  planLink?: ReactNode;
};

type StudentReviewState = {
  plan: ClassPlan | undefined;
  label: string;
  editable: boolean;
  canMove: boolean;
  canWithdraw: boolean;
};
type CasePeriod = { board: OrganizationBoard; historical: boolean; today: string };

function publicationLabel(row: Placement): string {
  const transfer = Boolean(row.sourceExitActionId && row.sourceSemesterId === row.semesterId);
  if (row.entryStatus === "CANCELLED")
    return transfer ? "Transferência cancelada" : "Entrada cancelada";
  if (row.entryStatus === "SCHEDULED")
    return transfer ? "Transferência agendada" : "Entrada agendada";
  if (row.entryStatus === "APPLIED")
    return transfer ? "Transferência efetivada" : "Entrada efetivada";
  return row.enrollmentId ? "Alocação confirmada" : "Alocação publicada";
}

function canWithdrawScheduledEntry(
  row: Placement,
  { board, today }: Pick<CasePeriod, "board" | "today">,
): boolean {
  return Boolean(
    row.publishedAt &&
    row.entryActionId &&
    row.entryStatus === "SCHEDULED" &&
    reviewEffectiveDate(row, board) > today,
  );
}

export function studentReviewState(
  row: Placement,
  { board, historical, today }: CasePeriod,
): StudentReviewState {
  const editable = !historical && !row.declinedAt;
  const canWithdraw = editable && canWithdrawScheduledEntry(row, { board, today });
  const canMovePublished =
    row.entryStatus === "SCHEDULED"
      ? canWithdraw
      : row.entryStatus !== "CANCELLED" && Boolean(row.enrollmentId);
  const destinationId = row.publishedAt ? row.planId : reviewDestinationId(row);
  return {
    plan: board.plans.find((item) => item.id === destinationId),
    label: reviewStatus(row, historical).label,
    editable,
    canMove:
      editable &&
      (row.classClosurePending || row.continuity !== "LEAVING") &&
      (!row.publishedAt || canMovePublished),
    canWithdraw,
  };
}

export function StudentReviewDetail({
  row,
  board,
  onAction,
  readOnly,
  children,
  planLink,
}: Props): ReactElement {
  const today = toDateOnlySaoPaulo(new Date());
  const historical = Boolean(readOnly) || dateOnly(board.semester.endDate) < today;
  const state = studentReviewState(row, { board, historical, today });
  const links = useReviewLinks(row, board.semester.id);
  const task = state.editable ? (needsReviewDestination(row) ? "turma" : "decisao") : "historico";
  const activeSignal = hasFormationSignal(row);
  const timeline = <CaseTimeline key={row.id} row={row} editable={state.editable} links={links} />;
  return (
    <div className={styles.detail}>
      <div className={styles.columns}>
        <div className={styles.decision}>
          {activeSignal && timeline}
          <section className={styles.proposal} aria-label="Vínculo do aluno">
            <h2 className={styles.caseTitle}>
              {row.confirmation === "PRECONFIRMED" ? "Continuidade na turma" : state.label}
            </h2>
            <StudentReviewFacts row={row} state={state} planLink={planLink} />
            <ReviewPending
              row={row}
              historical={historical}
              plan={state.plan}
              onAction={onAction}
            />
            {state.editable && <ReviewActions row={row} state={state} onAction={onAction} />}
          </section>
          {!activeSignal && timeline}
          {state.canMove && needsReviewDestination(row) && children}
        </div>
        <div className={styles.context}>
          <ReviewMetrics row={row} />
          <StudentContextFacts row={row} />
          <ReviewFollowUps row={row} links={links} task={task} />
        </div>
      </div>
    </div>
  );
}

export function useReviewLinks(row: Placement, semesterId: string): ProfileLinks {
  const base = `/alunos/${row.studentId}`;
  const path = usePathname();
  const params = useSearchParams();
  const back = path + "?" + params.toString();
  const profile = (parameters: Record<string, string>): string =>
    base + "?" + new URLSearchParams({ ...parameters, voltar: back }).toString();
  return {
    profile,
    requested: (task) => profile({ revisarVinculo: [semesterId, row.id, task].join(":") }),
  };
}

function Fact({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function businessDate(value: Date): string {
  return formatDateOnlyBR(toDateOnlySaoPaulo(new Date(value)));
}

type Heading = ReturnType<typeof reviewClassHeading>;
function ClassFact({
  label,
  heading,
  link,
}: {
  label: string;
  heading: Heading;
  link?: ReactNode;
}): ReactElement {
  return (
    <Fact label={label}>
      <strong>{heading.title}</strong>
      {heading.schedule && <span className={styles.schedule}>{heading.schedule}</span>}
      {heading.description && <span className={styles.classMeta}>{heading.description}</span>}
      {link}
    </Fact>
  );
}

function originHeading(row: Placement): Heading | null {
  if (!row.sourceClassName) return null;
  if (!row.sourceScheduleType) return { title: row.sourceClassName, description: "" };
  return reviewClassHeading(
    {
      scheduleType: row.sourceScheduleType,
      teacherName: row.sourceTeacher,
      stageCode: row.sourceStageCode,
      stageName: row.sourceStageName,
      slots: row.sourceSchedule,
    },
    row.sourceClassName,
  );
}

function sharedClassHeading(origin: Heading | null, destination: Heading | undefined): boolean {
  return Boolean(
    origin &&
    destination &&
    origin.title === destination.title &&
    origin.schedule === destination.schedule &&
    origin.description === destination.description,
  );
}

function destinationClassLabel(row: Placement, same: boolean): string {
  const closed = row.entryStatus === "CANCELLED" || Boolean(row.declinedAt);
  if (same) return closed ? "Turma de origem" : "Turma de origem e destino";
  if (closed) return "Destino da publicação";
  return row.publishedAt ? "Turma confirmada" : "Turma proposta";
}

function ReviewClasses({ row, state, planLink }: FactsProps): ReactElement {
  const { plan } = state;
  const origin = originHeading(row);
  const destination = plan && reviewClassHeading(plan, reviewPlanName(plan));
  const same =
    sharedClassHeading(origin, destination) && followsOwnClass(row.sourceClassId, plan ?? null);
  const destinationLabel = destinationClassLabel(row, same);
  return (
    <>
      {origin && !same && <ClassFact label="Turma de origem" heading={origin} />}
      {destination && <ClassFact label={destinationLabel} heading={destination} link={planLink} />}
      {!plan && !isReviewDeparture(row) && <Fact label="Turma de destino">A definir</Fact>}
    </>
  );
}

function academicDecision(row: Placement): string | null {
  if (!row.decision || row.assessmentDeletedAt) return null;
  const decision = row.decision === "REPEAT" ? "Repetência" : "Aprovação";
  return row.confirmedAt
    ? `${decision} confirmada em ${businessDate(row.confirmedAt)}`
    : `${decision} pendente de confirmação`;
}

type FactsProps = { row: Placement; state: StudentReviewState; planLink?: ReactNode };
function isNewEntry(row: Placement): boolean {
  return (
    row.mode === "ENTRY" &&
    !row.sourceEnrollmentId &&
    !row.sourceProgressId &&
    !row.classClosurePending
  );
}

export function StudentReviewFacts({ row, state, planLink }: FactsProps): ReactElement {
  const classStart =
    isNewEntry(row) && state.plan && !row.declinedAt ? dateOnly(state.plan.startDate) : null;
  return (
    <dl className={styles.caseFacts}>
      <ReviewClasses row={row} state={state} planLink={planLink} />
      {classStart && (
        <Fact label="Data de início da turma">
          <time dateTime={classStart}>{formatDateOnlyBR(classStart)}</time>
        </Fact>
      )}
      {row.confirmation === "PRECONFIRMED" && <PreconfirmationFacts row={row} />}
      {row.publishedAt && (
        <Fact label="Publicação">
          {[publicationLabel(row), businessDate(row.publishedAt), row.publishedBy]
            .filter(Boolean)
            .join(" · ")}
        </Fact>
      )}
      {row.declinedAt && <Fact label="Data do registro">{businessDate(row.declinedAt)}</Fact>}
    </dl>
  );
}

function PreconfirmationFacts({ row }: { row: Placement }): ReactElement {
  return (
    <>
      {row.attention.coverageThrough && (
        <Fact label="Cobertura do contrato">
          Até {formatDateOnlyBR(row.attention.coverageThrough)}
        </Fact>
      )}
      {row.stageId && !row.attention.materialMissing && (
        <Fact label="Material do estágio">Compra registrada</Fact>
      )}
    </>
  );
}

function responseReasonLabel(continuity: Placement["continuity"]): string {
  if (continuity === "CHANGE") return "Motivo da troca";
  if (continuity === "LEAVING") return "Motivo da possível saída";
  return "Observação da resposta";
}

type ContextFact = { label: string; value: string | null | undefined };

function progressAndResponseFacts(row: Placement): ContextFact[] {
  if (row.declinedAt)
    return [{ label: "Motivo da não continuidade", value: row.declinedReason?.trim() }];
  const previousStage = row.sourceStageName ?? row.sourceStageCode;
  const nextStage = row.stageName ?? row.stageCode;
  const stages = [...new Set([previousStage, nextStage].filter(Boolean))].join(" → ");
  const response =
    row.continuity === "CHANGE" || row.continuity === "LEAVING"
      ? responseLabels[row.continuity]
      : null;
  return [
    { label: "Percurso", value: [modes[row.mode], stages].filter(Boolean).join(" · ") },
    { label: "Decisão pedagógica", value: academicDecision(row) },
    { label: "Continuidade", value: response },
    { label: responseReasonLabel(row.continuity), value: row.continuityReason?.trim() },
  ];
}

function teamContextFacts(row: Placement): ContextFact[] {
  const decline = row.declinedReason?.trim();
  const reason = row.continuityReason?.trim();
  const note = row.notes?.trim();
  const attention = row.attentionNote?.trim();
  return [
    { label: "Nota da proposta", value: note !== reason && note !== decline ? note : null },
    {
      label: "Impedimento sinalizado pela equipe",
      value: attention !== reason && attention !== note && attention !== decline ? attention : null,
    },
  ];
}

function StudentContextFacts({ row }: { row: Placement }): ReactElement | null {
  if (
    row.declinedAt &&
    !row.declinedReason?.trim() &&
    !row.notes?.trim() &&
    !row.attentionNote?.trim()
  )
    return null;
  const facts = [...progressAndResponseFacts(row), ...teamContextFacts(row)];
  return (
    <dl className={styles.caseFacts} aria-label="Percurso e resposta do aluno">
      {facts.map(({ label, value }) =>
        value ? (
          <Fact key={label} label={label}>
            {value}
          </Fact>
        ) : null,
      )}
    </dl>
  );
}

function MoveReviewAction({
  row,
  chooseDestination,
  onAction,
}: Pick<Props, "row" | "onAction"> & { chooseDestination: boolean }): ReactElement {
  const chooseLabel = row.continuity === "CHANGE" ? "Escolher outra turma" : "Escolher turma";
  return (
    <Button
      variant={chooseDestination ? "primary" : "secondary"}
      onClick={() =>
        onAction(
          row.publishedAt
            ? { kind: "move", rows: [row] }
            : { kind: "placement", row, studentId: row.studentId },
        )
      }
    >
      <CalendarDays /> {chooseDestination ? chooseLabel : "Alterar turma"}
    </Button>
  );
}

function canSetReviewEntryDate(row: Placement, plan: ClassPlan | undefined): boolean {
  return Boolean(
    !row.publishedAt && row.stageId && isNewEntry(row) && (!row.planId || !plan?.closedAt),
  );
}

function ReviewActions({
  row,
  state,
  onAction,
}: Pick<Props, "row" | "onAction"> & {
  state: StudentReviewState;
}): ReactElement {
  const chooseDestination = needsReviewDestination(row);
  const fixDate = row.blockers.some(
    (reason) =>
      reason.includes("vigência") ||
      reason.includes("Vigência") ||
      reason === "A entrada antecede o início da turma.",
  );
  const canSetDate = canSetReviewEntryDate(row, state.plan);
  return (
    <div className={styles.actions}>
      {state.canMove && (
        <MoveReviewAction row={row} chooseDestination={chooseDestination} onAction={onAction} />
      )}
      <Button variant="warning" onClick={() => onAction({ kind: "continuity", row })}>
        <TriangleAlert /> {row.attentionNote ? "Revisar sinalização" : "Sinalizar risco"}
      </Button>
      {canSetDate && (
        <Button
          variant={fixDate && !chooseDestination && !isReviewDeparture(row) ? "primary" : "link"}
          onClick={() => onAction({ kind: "placementDate", row })}
        >
          {fixDate ? "Corrigir data de entrada" : "Ajustar data de entrada"}
        </Button>
      )}
      {state.canWithdraw && (
        <Button variant="destructive-ghost" onClick={() => onAction({ kind: "withdraw", row })}>
          <Undo2 /> Desfazer alocação
        </Button>
      )}
    </div>
  );
}
