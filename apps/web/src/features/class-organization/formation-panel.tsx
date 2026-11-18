"use client";
import { type ReactElement } from "react";
import Link from "next/link";
import { ArrowLeft, Check, UsersRound } from "lucide-react";
import { Button } from "@lazuli/ui";
import { FormationQueue } from "./formation-queue";
import { formatDateOnlyBR } from "~/lib/format";
import { PendingLead, PendingStudent } from "./queue-details";
import { dateOnly, scheduleLabel } from "./shared";
import {
  compatible,
  type ClassPlan,
  type OrganizationAction,
  type OrganizationBoard,
  type Placement,
} from "./model";
import { CompositionMenu } from "./composition-sections";
import { useCompositionModel } from "./composition-model";
import { planMetrics } from "./confirmation";
import type { PanelPerson } from "./use-formation-navigation";
import { FormationPersonRow, LeadItem } from "./formation-roster";
import styles from "./formation.module.css";

type Props = {
  board: OrganizationBoard;
  plan: ClassPlan | undefined;
  selection: PanelPerson | null;
  ended: boolean;
  grouped: boolean;
  expandQueue: (origin: HTMLElement) => void;
  onSelect: (value: PanelPerson, origin: HTMLElement) => void;
  onSelectPlan: (plan: ClassPlan, origin: HTMLElement) => void;
  onBack: () => void;
  onAction: (action: OrganizationAction) => void;
  onFeedback: (value: string) => void;
};

export function FormationPanel(props: Props): ReactElement {
  const { board, selection, plan, onBack } = props;
  const { student, lead } = selectedPerson(board, selection);
  const personName = student?.studentName ?? lead?.fullName;
  const title = plan ? planTitle(plan) : personName;
  return (
    <aside id="formation-panel" className={styles.panel} aria-label="Painel de formação">
      <FormationQueue
        board={board}
        grouped={props.grouped}
        expandQueue={props.expandQueue}
        onBack={onBack}
        hidden={Boolean(title)}
        ended={props.ended}
        onAction={props.onAction}
        onSelect={props.onSelect}
      />
      {title && (
        <div className={styles.panelTitle}>
          <Button
            size="sm"
            variant="ghost"
            onClick={onBack}
            aria-label="Voltar à visualização anterior"
          >
            <ArrowLeft size={16} /> Voltar
          </Button>
          <h2 id="formation-panel-heading" tabIndex={-1}>
            {title}
          </h2>
        </div>
      )}
      {plan ? (
        <PlanDetail {...props} plan={plan} student={student} />
      ) : (
        <PersonDetail {...props} student={student} lead={lead} />
      )}
    </aside>
  );
}
function selectedPerson(
  board: OrganizationBoard,
  selection: PanelPerson | null,
): { student: Placement | undefined; lead: OrganizationBoard["waitingLeads"][number] | undefined } {
  const student =
    selection?.kind === "student"
      ? board.placements.find((row) => row.id === selection.id)
      : undefined;
  const lead =
    selection && selection.kind === "lead"
      ? board.waitingLeads.find((candidate) => candidate.id === selection.id)
      : undefined;
  return { student, lead };
}
function planTitle(plan: ClassPlan): string {
  return plan.scheduleType === "PERSONALIZED" ? plan.name : (plan.stageCode ?? plan.name);
}
function PersonDetail({
  board,
  onSelectPlan,
  onAction,
  ended,
  student,
  lead,
}: Props & {
  student: Placement | undefined;
  lead: OrganizationBoard["waitingLeads"][number] | undefined;
}): ReactElement | null {
  const openPlan = (id: string | null, origin: HTMLElement): void => {
    const choice = board.plans.find((plan) => plan.id === id);
    if (choice) onSelectPlan(choice, origin);
  };
  if (lead) return <PendingLead lead={lead} board={board} onSelect={openPlan} />;
  if (student)
    return (
      <PendingStudent
        row={student}
        board={board}
        ended={ended}
        onAction={onAction}
        onSelect={openPlan}
      />
    );
  return null;
}
function PlanDetail({
  board,
  plan,
  student,
  ended,
  onSelect,
  onAction,
  onFeedback,
}: Props & { plan: ClassPlan; student: Placement | undefined }): ReactElement {
  const metrics = planMetrics(board, plan);
  const model = useCompositionModel({ board, plan, onFeedback });
  return (
    <div className={styles.panelScroll} data-formation-scroll="">
      <div className={styles.studentFacts}>
        <div className={styles.planHeading}>
          <span>{plan.scheduleType === "PERSONALIZED" ? "PPT" : `Regular · ${plan.name}`}</span>
          <CompositionMenu plan={plan} ended={ended} onAction={onAction} />
        </div>
        <strong>{scheduleLabel(plan.slots)}</strong>
        <p>
          {plan.teacherName ?? "Professor a definir"} · Início em{" "}
          {formatDateOnlyBR(dateOnly(plan.startDate))}
        </p>
        <div className={styles.planCounts}>
          <UsersRound size={15} />
          {metrics.confirmed - metrics.preconfirmed} confirmados · <Check size={14} />{" "}
          {metrics.preconfirmed} pré-confirmados · {metrics.pending} a confirmar
        </div>
        {plan.active && metrics.confirmed <= board.semester.formationRiskLimit && (
          <p className={styles.warning}>
            Turma em risco · limite de {board.semester.formationRiskLimit} alunos
          </p>
        )}
        <ProposePlace student={student} plan={plan} ended={ended} onAction={onAction} />
        <PublishPlaces model={model} enabled={!ended && plan.active} primary={!student} />
        {model.error && <p role="alert">{model.error}</p>}
        {plan.classId && <Link href={`/turmas/${plan.classId}`}>Abrir cadastro da turma</Link>}
      </div>
      <div className={styles.rosterGroup}>
        <header>
          <h3>Alunos da turma</h3>
          <small>{model.rows.length}</small>
        </header>
        {model.rows.map((row) => (
          <FormationPersonRow key={row.id} row={row} onSelect={onSelect} />
        ))}
        {model.rows.length === 0 && (
          <p className={styles.suggestionNote}>Nenhum aluno proposto para esta turma.</p>
        )}
      </div>
      {model.leads.map((lead) => (
        <LeadItem key={lead.id} lead={lead} onSelect={onSelect} />
      ))}
    </div>
  );
}

function ProposePlace({
  student,
  plan,
  ended,
  onAction,
}: {
  student: Placement | undefined;
  plan: ClassPlan;
  ended: boolean;
  onAction: Props["onAction"];
}): ReactElement | null {
  if (!student || ended || !compatible(student, plan)) return null;
  return (
    <Button
      size="sm"
      onClick={() =>
        onAction(
          student.publishedAt
            ? { kind: "move", rows: [student], planId: plan.id }
            : {
                kind: "placement",
                row: student,
                studentId: student.studentId,
                planId: plan.id,
              },
        )
      }
    >
      Propor encaixe para {student.studentName.split(" ")[0]}
    </Button>
  );
}

function PublishPlaces({
  model,
  enabled,
  primary,
}: {
  model: ReturnType<typeof useCompositionModel>;
  enabled: boolean;
  primary: boolean;
}): ReactElement | null {
  if (!enabled || model.ready.length === 0) return null;
  return (
    <Button
      size="sm"
      variant={primary ? "primary" : "secondary"}
      disabled={model.pending}
      onClick={model.onPublish}
    >
      Oficializar {model.ready.length} {model.ready.length === 1 ? "vínculo" : "vínculos"}
    </Button>
  );
}
