import type { JSX as ReactJSX } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@lazuli/ui";
import { dateOnly, scheduleLabel } from "~/features/semester-organization/shared";
import { toDateOnlySaoPaulo } from "~/lib/format";
import {
  contractLabel,
  suggestedPlans,
  type OrganizationAction,
  type Placement,
  type SemesterBoard,
} from "./model";
import s from "./organization.module.css";
export type QueueProps = {
  board: SemesterBoard;
  onAction: (action: OrganizationAction) => void;
  onSelect: (id: string | null) => void;
};
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
  const choose = (planId?: string) =>
    onAction(
      row.publishedAt
        ? { kind: "move", rows: [row], ...(planId ? { planId } : {}) }
        : { kind: "placement", studentId: row.studentId, row, ...(planId ? { planId } : {}) },
    );
  return (
    <div className={s.queueDetails}>
      <div className={s.detail}>
        {(row.continuityReason || row.notes) && (
          <p className="text-caption">{row.continuityReason || row.notes}</p>
        )}
        <dl className={s.facts}>
          {row.sourceClassName && (
            <>
              <dt>Turma atual</dt>
              <dd>{row.sourceClassName}</dd>
            </>
          )}
          <dt>Horários</dt>
          <dd>
            {row.availability?.slots.length ? scheduleLabel(row.availability.slots) : "A combinar"}
          </dd>
          <dt>Contrato</dt>
          <dd>
            {row.nextPeriodCovered
              ? `Cobre ${board.nextSemester?.name}`
              : row.periodCovered
                ? "Cobre este período"
                : contractLabel(row).label}
          </dd>
        </dl>
        <div className={s.actions}>
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
        {row.blockers.length > 0 && (
          <details className={s.small}>
            <summary>O que falta confirmar · {row.blockers.length}</summary>
            <ul className="grid gap-1 pt-2">
              {row.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </details>
        )}
        <section className={s.suggestions}>
          <h3>
            {suggestions.length > 0 ? "Turmas compatíveis" : "Sem turma compatível por enquanto"}
          </h3>
          {suggestions.slice(0, 5).map((plan) => (
            <button
              type="button"
              className={s.queueItem}
              key={plan.id}
              disabled={ended}
              onClick={() => choose(plan.id)}
            >
              <span className={s.person}>
                <strong>{plan.name}</strong>
                <span className={s.small}>{scheduleLabel(plan.slots)}</span>
              </span>
              <ChevronRight size={14} />
            </button>
          ))}
          {suggestions.length === 0 && (
            <p className={s.small}>
              A pessoa permanece na fila. Você pode reunir outras do mesmo estágio e formar uma
              turma.
            </p>
          )}
        </section>
        {row.planId && !row.publishedAt && (
          <Button size="sm" variant="secondary" onClick={() => onSelect(row.planId)}>
            Ver turma proposta
          </Button>
        )}
      </div>
      <footer className={s.selection}>
        <Button size="sm" disabled={ended} onClick={() => choose()}>
          Escolher turma <ArrowRight size={14} />
        </Button>
      </footer>
    </div>
  );
}

export function PendingLead({
  lead,
  board,
  onSelect,
}: Pick<QueueProps, "board" | "onSelect"> & {
  lead: SemesterBoard["waitingLeads"][number];
}): ReactJSX.Element {
  return (
    <div className={s.queueDetails}>
      <div className={s.detail}>
        <p className="text-caption">{lead.allocationPendingReason}</p>
        <dl className={s.facts}>
          <dt>Interesse</dt>
          <dd>
            {lead.scheduleType === "PERSONALIZED"
              ? "PPT"
              : lead.scheduleType === "REGULAR"
                ? "Regular"
                : "A combinar"}{" "}
            ·{" "}
            {lead.format === "ONLINE"
              ? "Online"
              : lead.format === "IN_PERSON"
                ? "Presencial"
                : "Formato a combinar"}
          </dd>
          <dt>Horários</dt>
          <dd>{lead.slots.length > 0 ? scheduleLabel(lead.slots) : "A combinar"}</dd>
        </dl>
        {lead.allocationPlan && (
          <div className={s.summary}>
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
        )}
        {lead.notes && <p className={s.small}>{lead.notes}</p>}
      </div>
      <footer className={s.selection}>
        <Button size="sm" nativeButton={false} render={<Link href={`/interessados/${lead.id}`} />}>
          Continuar pelo lead <ArrowRight size={14} />
        </Button>
      </footer>
    </div>
  );
}
