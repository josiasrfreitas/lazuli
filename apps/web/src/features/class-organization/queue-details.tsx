"use client";
import { trpc } from "~/lib/trpc";
import type { JSX as ReactJSX } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@lazuli/ui";
import {
  dateOnly,
  scheduleLabel,
  useOrganizationRefresh,
} from "~/features/class-organization/shared";
import { toDateOnlySaoPaulo } from "~/lib/format";
import {
  suggestedPlans,
  type ClassPlan,
  type OrganizationAction,
  type Placement,
  type OrganizationBoard,
} from "./model";
import styles from "./organization.module.css";
import formation from "./formation.module.css";
import { StudentReviewDetail } from "./review-detail";

const MAX_PLAN_SUGGESTIONS = 5;
export type QueueProps = {
  board: OrganizationBoard;
  onAction: (action: OrganizationAction) => void;
  onSelect: (id: string | null, origin: HTMLElement) => void;
};
type WaitingLead = OrganizationBoard["waitingLeads"][number];
export function PendingStudent({
  row,
  board,
  ended,
  onAction,
  onSelect,
}: QueueProps & { row: Placement; ended: boolean }): ReactJSX.Element {
  const suggestions = suggestedPlans(row, board);
  const choose = (planId?: string): void =>
    onAction(
      row.publishedAt
        ? { kind: "move", rows: [row], ...(planId ? { planId } : {}) }
        : { kind: "placement", studentId: row.studentId, row, ...(planId ? { planId } : {}) },
    );
  return (
    <>
      <div className={formation.panelScroll} data-formation-scroll="">
        <StudentReviewDetail board={board} row={row} readOnly={ended} onAction={onAction} />
        <StudentSuggestions suggestions={suggestions} ended={ended} choose={choose} />
        {row.planId && !row.publishedAt && (
          <Button
            size="sm"
            variant="ghost"
            data-formation-focus="proposed"
            onClick={(event) => onSelect(row.planId, event.currentTarget)}
          >
            Ver turma proposta
          </Button>
        )}
      </div>
    </>
  );
}

function StudentSuggestions({
  suggestions,
  ended,
  choose,
}: {
  suggestions: ClassPlan[];
  ended: boolean;
  choose: (planId?: string) => void;
}): ReactJSX.Element {
  return (
    <section className={formation.suggestions}>
      <h3>{suggestions.length > 0 ? "Escolher turma de destino" : "Nenhuma turma compatível"}</h3>
      {suggestions.length > 0 && (
        <p className={formation.suggestionNote}>
          Selecione um horário para revisar a proposta de alocação.
        </p>
      )}
      {suggestions.slice(0, MAX_PLAN_SUGGESTIONS).map((plan) => (
        <button
          type="button"
          className={formation.item}
          key={plan.id}
          disabled={ended}
          onClick={() => choose(plan.id)}
        >
          <span>
            <strong>
              {plan.scheduleType === "PERSONALIZED" ? "PPT" : (plan.stageCode ?? plan.name)} ·{" "}
              {plan.teacherName ?? "Professor a definir"}
            </strong>
            <small>{scheduleLabel(plan.slots) || "Horário a definir"}</small>
          </span>
          <ChevronRight size={14} />
        </button>
      ))}
      {suggestions.length > MAX_PLAN_SUGGESTIONS && (
        <Button size="sm" variant="ghost" disabled={ended} onClick={() => choose()}>
          Escolher entre as {suggestions.length} turmas
        </Button>
      )}
      {suggestions.length === 0 && (
        <p className={formation.suggestionNote}>
          O aluno segue na fila. Você pode reunir alunos do mesmo estágio para formar uma turma.
        </p>
      )}
    </section>
  );
}

export function PendingLead({
  lead,
  board,
  onSelect,
}: Pick<QueueProps, "board" | "onSelect"> & {
  lead: WaitingLead;
}): ReactJSX.Element {
  return (
    <>
      <div className={formation.panelScroll} data-formation-scroll="">
        <div className={formation.personSummary}>
          <p>{lead.allocationPendingReason}</p>
          <dl className={styles.facts}>
            <dt>Interesse</dt>
            <dd>
              {leadScheduleType(lead)} · {leadFormat(lead)}
            </dd>
          </dl>
          <LeadProposal lead={lead} board={board} onSelect={onSelect} />
          {!lead.allocationPlan && <LeadSuggestions lead={lead} board={board} />}
          {lead.notes && <p className={styles.small}>{lead.notes}</p>}
        </div>
      </div>
      <footer className={formation.panelFooter}>
        <Button size="sm" nativeButton={false} render={<Link href={`/interessados/${lead.id}`} />}>
          Continuar pelo lead <ArrowRight size={14} />
        </Button>
      </footer>
    </>
  );
}

function leadScheduleType(lead: WaitingLead): string {
  if (lead.scheduleType === "PERSONALIZED") return "PPT";
  if (lead.scheduleType === "REGULAR") return "Regular";
  return "Modalidade a combinar";
}

function leadFormat(lead: WaitingLead): string {
  if (lead.format === "ONLINE") return "Online";
  if (lead.format === "IN_PERSON") return "Presencial";
  return "Formato a combinar";
}

function LeadProposal({
  lead,
  board,
  onSelect,
}: {
  lead: WaitingLead;
  board: OrganizationBoard;
  onSelect: QueueProps["onSelect"];
}): ReactJSX.Element | null {
  if (!lead.allocationPlan) return null;
  return (
    <div className={styles.summary}>
      <strong>Turma proposta: {lead.allocationPlan.name}</strong>
      <p>
        {lead.allocationPlan.classId &&
        dateOnly(board.semester.startDate) <= toDateOnlySaoPaulo(new Date())
          ? "A turma está aberta. Finalize a matrícula no lead."
          : "Interesse registrado. Com o estágio definido, o lead já pode ser cadastrado como aluno."}
      </p>
      {lead.allocationPlan.semesterId === board.semester.id && (
        <Button
          size="sm"
          variant="secondary"
          data-formation-focus="proposed"
          onClick={(event) => onSelect(lead.allocationPlanId, event.currentTarget)}
        >
          Ver turma proposta
        </Button>
      )}
    </div>
  );
}

function LeadSuggestions({
  lead,
  board,
}: {
  lead: WaitingLead;
  board: OrganizationBoard;
}): ReactJSX.Element {
  const refresh = useOrganizationRefresh();
  const mutation = trpc.semesterOrganization.assignLeadInterest.useMutation({ onSuccess: refresh });
  const ended = dateOnly(board.semester.endDate) < toDateOnlySaoPaulo(new Date());
  const plans = board.plans
    .filter(
      (plan) =>
        plan.active &&
        (!lead.scheduleType || plan.scheduleType === lead.scheduleType) &&
        (!lead.format || plan.format === lead.format) &&
        (plan.scheduleType === "PERSONALIZED" || plan.sharedStageId === lead.stageId),
    )
    .toSorted(
      (left, right) =>
        Number(right.scheduleType === "PERSONALIZED") -
        Number(left.scheduleType === "PERSONALIZED"),
    );
  return (
    <section className={styles.suggestions}>
      <h3>Vincular interesse a uma turma</h3>
      {plans.map((plan) => (
        <Button
          key={plan.id}
          size="sm"
          variant="secondary"
          disabled={ended || mutation.isPending}
          onClick={() => mutation.mutate({ leadId: lead.id, planId: plan.id })}
        >
          {plan.scheduleType === "PERSONALIZED" ? "PPT" : plan.stageCode} · {plan.name}
        </Button>
      ))}
      {plans.length === 0 && (
        <p className={styles.small}>Nenhuma turma compatível. O lead permanece aguardando.</p>
      )}
      {mutation.error && (
        <p role="alert" className="text-destructive">
          {mutation.error.message}
        </p>
      )}
    </section>
  );
}
