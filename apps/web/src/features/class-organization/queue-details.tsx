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
  contractLabel,
  suggestedPlans,
  type ClassPlan,
  type OrganizationAction,
  type Placement,
  type OrganizationBoard,
} from "./model";
import styles from "./organization.module.css";

const MAX_PLAN_SUGGESTIONS = 5;
export type QueueProps = {
  board: OrganizationBoard;
  onAction: (action: OrganizationAction) => void;
  onSelect: (id: string | null) => void;
};
type WaitingLead = OrganizationBoard["waitingLeads"][number];
export function PendingStudent({
  row,
  board,
  onAction,
  onSelect,
}: QueueProps & { row: Placement }): ReactJSX.Element {
  const ended = dateOnly(board.semester.endDate) < toDateOnlySaoPaulo(new Date());
  const suggestions = suggestedPlans(row, board).filter(
    (plan) =>
      row.continuity !== "CHANGE" || (plan.classId !== row.sourceClassId && plan.id !== row.planId),
  );
  const choose = (planId?: string): void =>
    onAction(
      row.publishedAt
        ? { kind: "move", rows: [row], ...(planId ? { planId } : {}) }
        : { kind: "placement", studentId: row.studentId, row, ...(planId ? { planId } : {}) },
    );
  return (
    <div className={styles.queueDetails}>
      <div className={styles.detail}>
        <StudentFacts row={row} />
        <StudentBlockers row={row} />
        <StudentSuggestions suggestions={suggestions} ended={ended} choose={choose} />
        {row.planId && !row.publishedAt && (
          <Button size="sm" variant="secondary" onClick={() => onSelect(row.planId)}>
            Ver turma proposta
          </Button>
        )}
      </div>
      <footer className={styles.selection}>
        <Button size="sm" disabled={ended} onClick={() => choose()}>
          Escolher turma <ArrowRight size={14} />
        </Button>
      </footer>
    </div>
  );
}

function StudentFacts({ row }: { row: Placement }): ReactJSX.Element {
  return (
    <>
      {(row.continuityReason || row.notes) && (
        <p className="text-caption">{row.continuityReason || row.notes}</p>
      )}
      <dl className={styles.facts}>
        {row.sourceClassName && (
          <>
            <dt>Turma atual</dt>
            <dd>{row.sourceClassName}</dd>
          </>
        )}
        <dt>Contrato</dt>
        <dd>{contractCoverage(row)}</dd>
      </dl>
      <div className={styles.actions}>
        <Link className="text-caption text-interactive" href={`/alunos/${row.studentId}`}>
          Perfil do aluno
        </Link>
      </div>
    </>
  );
}

function contractCoverage(row: Placement): string {
  if (row.confirmation === "PRECONFIRMED") return "Cobre os três primeiros meses do período";
  if (row.periodCovered) return "Cobre este período";
  return contractLabel(row).label;
}

function StudentBlockers({ row }: { row: Placement }): ReactJSX.Element | null {
  if (row.blockers.length === 0) return null;
  return (
    <details className={styles.small}>
      <summary>O que falta confirmar · {row.blockers.length}</summary>
      <ul className="grid gap-1 pt-2">
        {row.blockers.map((blocker) => (
          <li key={blocker}>{blocker}</li>
        ))}
      </ul>
    </details>
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
    <section className={styles.suggestions}>
      <h3>{suggestions.length > 0 ? "Turmas compatíveis" : "Sem turma compatível por enquanto"}</h3>
      {suggestions.slice(0, MAX_PLAN_SUGGESTIONS).map((plan) => (
        <button
          type="button"
          className={styles.queueItem}
          key={plan.id}
          disabled={ended}
          onClick={() => choose(plan.id)}
        >
          <span className={styles.person}>
            <strong>{plan.name}</strong>
            <span className={styles.small}>{scheduleLabel(plan.slots)}</span>
          </span>
          <ChevronRight size={14} />
        </button>
      ))}
      {suggestions.length === 0 && (
        <p className={styles.small}>
          A pessoa permanece na fila. Você pode reunir outras do mesmo estágio e formar uma turma.
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
    <div className={styles.queueDetails}>
      <div className={styles.detail}>
        <p className="text-caption">{lead.allocationPendingReason}</p>
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
      <footer className={styles.selection}>
        <Button size="sm" nativeButton={false} render={<Link href={`/interessados/${lead.id}`} />}>
          Continuar pelo lead <ArrowRight size={14} />
        </Button>
      </footer>
    </div>
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
          : "Interesse reservado. A matrícula será concluída quando o período estiver vigente."}
      </p>
      {lead.allocationPlan.semesterId === board.semester.id && (
        <Button size="sm" variant="secondary" onClick={() => onSelect(lead.allocationPlanId)}>
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
  const plans = board.plans.filter(
    (plan) =>
      plan.active &&
      (!lead.scheduleType || plan.scheduleType === lead.scheduleType) &&
      (!lead.format || plan.format === lead.format) &&
      (plan.scheduleType === "PERSONALIZED" || plan.sharedStageId === lead.stageId),
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
          {plan.name}
        </Button>
      ))}
      {plans.length === 0 && (
        <p className={styles.small}>Nenhuma turma compatível. O lead permanece aguardando.</p>
      )}
      {mutation.error && (
        <p role="alert" className="text-caption text-destructive">
          {mutation.error.message}
        </p>
      )}
    </section>
  );
}
