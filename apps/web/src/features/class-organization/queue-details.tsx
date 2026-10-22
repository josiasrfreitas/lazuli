import type { JSX as ReactJSX } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@lazuli/ui";
import { dateOnly, scheduleLabel } from "~/features/semester-organization/shared";
import { toDateOnlySaoPaulo } from "~/lib/format";
import {
  contractLabel,
  suggestedPlans,
  type ClassPlan,
  type OrganizationAction,
  type Placement,
  type SemesterBoard,
} from "./model";
import styles from "./organization.module.css";

const MAX_PLAN_SUGGESTIONS = 5;
const UNSCHEDULED = "A combinar";
export type QueueProps = {
  board: SemesterBoard;
  onAction: (action: OrganizationAction) => void;
  onSelect: (id: string | null) => void;
};
type WaitingLead = SemesterBoard["waitingLeads"][number];
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
        <StudentFacts row={row} board={board} ended={ended} onAction={onAction} />
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

function StudentFacts({
  row,
  board,
  ended,
  onAction,
}: {
  row: Placement;
  board: SemesterBoard;
  ended: boolean;
  onAction: QueueProps["onAction"];
}): ReactJSX.Element {
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
        <dt>Horários</dt>
        <dd>
          {row.availability?.slots.length ? scheduleLabel(row.availability.slots) : UNSCHEDULED}
        </dd>
        <dt>Contrato</dt>
        <dd>{contractCoverage(row, board)}</dd>
      </dl>
      <div className={styles.actions}>
        <Button
          size="sm"
          variant="ghost"
          disabled={ended}
          onClick={() => onAction({ kind: "availability", studentId: row.studentId })}
        >
          Editar disponibilidade
        </Button>
        <Link className="text-caption text-interactive" href={`/alunos/${row.studentId}`}>
          Perfil do aluno
        </Link>
      </div>
    </>
  );
}

function contractCoverage(row: Placement, board: SemesterBoard): string {
  if (row.nextPeriodCovered) return `Cobre ${board.nextSemester?.name}`;
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
          <dt>Horários</dt>
          <dd>{lead.slots.length > 0 ? scheduleLabel(lead.slots) : UNSCHEDULED}</dd>
        </dl>
        <LeadProposal lead={lead} board={board} onSelect={onSelect} />
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
  return UNSCHEDULED;
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
  board: SemesterBoard;
  onSelect: QueueProps["onSelect"];
}): ReactJSX.Element | null {
  if (!lead.allocationPlan) return null;
  return (
    <div className={styles.summary}>
      <strong>Turma proposta: {lead.allocationPlan.name}</strong>
      <p>
        {lead.allocationPlan.classId
          ? "A turma está aberta. Finalize a matrícula no lead."
          : "Abra a turma após definir o horário e o professor."}
      </p>
      {lead.allocationPlan.semesterId === board.semester.id && (
        <Button size="sm" variant="secondary" onClick={() => onSelect(lead.allocationPlanId)}>
          Ver turma proposta
        </Button>
      )}
    </div>
  );
}
