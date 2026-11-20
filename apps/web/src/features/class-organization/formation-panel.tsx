"use client";
import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { FormationDetailBreadcrumb, formationPlanTitle } from "./formation-detail-breadcrumb";
import { StudentAvatar } from "~/components/student-avatar";
import { Badge, Button } from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import { PendingLead, PendingStudent } from "./queue-details";
import { compactSchedule, dateOnly } from "./shared";
import {
  compatible,
  rowsFor,
  type ClassPlan,
  type OrganizationAction,
  type OrganizationBoard,
  type Placement,
} from "./model";
import { CompositionMenu } from "./composition-sections";
import { reviewGroupPlanId, reviewOriginPlans } from "./review-group-model";
import { useFormationReviewHref } from "./review-navigation";
import { confirmationLabels, confirmationVariants, planMetrics } from "./confirmation";
import type { PanelPerson } from "./use-formation-navigation";
import { PlanRoster, type usePlanRosterFilters } from "./plan-roster";
import sheet from "./plan-detail.module.css";
import styles from "./formation.module.css";

export type FormationRosterFilters = ReturnType<typeof usePlanRosterFilters>;

type Props = {
  board: OrganizationBoard;
  plan: ClassPlan | undefined;
  selection: PanelPerson | null;
  ended: boolean;
  rosterFilters: FormationRosterFilters;
  returnParent?:
    | { label: string; planId: string | null; href: string; review: boolean }
    | undefined;
  onSelect: (value: PanelPerson, origin: HTMLElement) => void;
  onSelectPlan: (plan: ClassPlan, origin: HTMLElement) => void;
  onBack: () => void;
  onAction: (action: OrganizationAction) => void;
};

export function FormationPanel(props: Props): ReactElement {
  const { board, selection, plan, returnParent } = props;
  const { student, lead } = selectedPerson(board, selection);
  const personName = student?.studentName ?? lead?.fullName;
  const title = plan ? formationPlanTitle(plan) : personName;
  if (!title && (selection || returnParent?.review)) return <UnavailablePanel {...props} />;
  if (plan) {
    return (
      <PanelFrame {...props} title={title} detail="plan">
        <PlanDetail {...props} plan={plan} student={student} />
      </PanelFrame>
    );
  }
  return <PersonPanel {...props} title={title} student={student} lead={lead} />;
}

function PersonPanel({
  title,
  student,
  lead,
  ...props
}: Props & {
  title: string | undefined;
  student: Placement | undefined;
  lead: OrganizationBoard["waitingLeads"][number] | undefined;
}): ReactElement {
  const detail = student ? "student" : undefined;
  return (
    <PanelFrame {...props} title={title} detail={lead ? "lead" : detail}>
      {title && (
        <PanelHeading title={title} student={student} semester={props.board.semester.name} />
      )}
      <PersonDetail {...props} student={student} lead={lead} />
    </PanelFrame>
  );
}

function PanelFrame({
  title,
  detail,
  returnParent,
  onBack,
  children,
}: Pick<Props, "returnParent" | "onBack"> & {
  title: string | undefined;
  detail: "plan" | "student" | "lead" | undefined;
  children: ReactNode;
}): ReactElement {
  return (
    <aside
      id="formation-panel"
      className={styles.panel}
      aria-label="Painel de formação"
      data-plan-detail={detail === "plan" ? "" : undefined}
      data-student-detail={detail === "student" ? "" : undefined}
      data-lead-detail={detail === "lead" ? "" : undefined}
    >
      {title && <FormationDetailBreadcrumb name={title} onBack={onBack} parent={returnParent} />}
      {children}
    </aside>
  );
}

function UnavailablePanel({
  returnParent,
  onBack,
}: Pick<Props, "returnParent" | "onBack">): ReactElement {
  return (
    <aside id="formation-panel" className={styles.panel} aria-label="Painel de formação">
      <FormationDetailBreadcrumb name="Ficha indisponível" onBack={onBack} parent={returnParent} />
      <div className={styles.zero}>
        <h2 id="formation-panel-heading" tabIndex={-1}>
          Ficha indisponível neste período
        </h2>
        <Button size="compact-responsive" variant="secondary" onClick={onBack}>
          <ArrowLeft /> {returnParent?.review ? "Voltar à revisão" : "Voltar à formação"}
        </Button>
      </div>
    </aside>
  );
}

function PanelHeading({
  title,
  student,
  semester,
}: {
  title: string;
  student: Placement | undefined;
  semester: string;
}): ReactElement {
  if (student) {
    return (
      <div className={styles.studentMasthead}>
        <header className={styles.studentHeader}>
          <StudentIdentity row={student} semester={semester} />
        </header>
      </div>
    );
  }
  return (
    <header className={styles.panelTitle}>
      <div className={styles.identity}>
        <h1 id="formation-panel-heading" tabIndex={-1}>
          {title}
        </h1>
        <p>Lead · {semester}</p>
      </div>
    </header>
  );
}

function StudentIdentity({ row, semester }: { row: Placement; semester: string }): ReactElement {
  const showConfirmation = !row.declinedAt && row.entryStatus !== "CANCELLED";
  return (
    <>
      <StudentAvatar name={row.studentName} colorKey={row.studentId} size="lg" />
      <div className={styles.identity}>
        <h1 id="formation-panel-heading" tabIndex={-1}>
          {row.studentName}
        </h1>
        <p>Formação de turmas · {semester}</p>
      </div>
      {showConfirmation && (
        <Badge variant={confirmationVariants[row.confirmation]}>
          {confirmationLabels[row.confirmation]}
        </Badge>
      )}
    </>
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
function planContext(
  plan: ClassPlan,
  { title, destination, semester }: { title: string; destination: string; semester: string },
): string {
  return [
    title === destination ? "Turma seguinte" : null,
    plan.scheduleType === "PERSONALIZED" ? "PPT" : "Regular",
    semester,
    !plan.active && "Desfeita",
    plan.active && !plan.classId && "Planejada",
    plan.name !== title && plan.name !== destination ? plan.name : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function PlanDetail({
  board,
  plan,
  student,
  ended,
  onSelect,
  onAction,
  rosterFilters,
}: Props & {
  plan: ClassPlan;
  student: Placement | undefined;
}): ReactElement {
  const metrics = planMetrics(board, plan);
  const rows = rowsFor(board, plan.id);
  const leads = board.waitingLeads.filter((lead) => lead.allocationPlanId === plan.id);
  const origins = reviewOriginPlans(board.plans);
  const hasReviewGroup =
    leads.length > 0 || board.placements.some((row) => reviewGroupPlanId(row, origins) === plan.id);
  const reviewHref = useFormationReviewHref(board.semester.id, plan.id);
  const title = formationPlanTitle(plan);
  const destination = plan.className ?? plan.name;
  const context = planContext(plan, { title, destination, semester: board.semester.name });
  return (
    <div className={styles.panelScroll} data-formation-scroll="">
      <div className={sheet.content}>
        <header className={sheet.header}>
          <div className={sheet.heading}>
            <div className={sheet.identity}>
              <h1 id="formation-panel-heading" tabIndex={-1}>
                {title}
              </h1>
              <p>{context}</p>
            </div>
            <div className={sheet.actions}>
              <ProposePlace student={student} plan={plan} ended={ended} onAction={onAction} />
              {hasReviewGroup && (
                <Button
                  size="sm"
                  variant={student && compatible(student, plan) && !ended ? "secondary" : "primary"}
                  nativeButton={false}
                  render={<Link href={reviewHref} scroll={false} />}
                >
                  {ended || !plan.active ? "Consultar vínculos" : "Revisar alocações"}
                </Button>
              )}
              <CompositionMenu plan={plan} ended={ended} onAction={onAction} />
            </div>
          </div>
          <PlanFacts
            plan={plan}
            destination={title === destination ? null : destination}
            confirmed={metrics.expected}
            riskLimit={board.semester.formationRiskLimit}
          />
        </header>
        <PlanRoster
          planId={plan.id}
          filters={rosterFilters}
          rows={rows}
          leads={leads}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}

function PlanFacts({
  plan,
  destination,
  confirmed,
  riskLimit,
}: {
  plan: ClassPlan;
  destination: string | null;
  confirmed: number;
  riskLimit: number;
}): ReactElement {
  return (
    <>
      <dl className={sheet.facts}>
        {destination && (
          <div>
            <dt>Turma seguinte</dt>
            <dd>{destination}</dd>
          </div>
        )}
        <div>
          <dt>Horário</dt>
          <dd>{compactSchedule(plan.slots) || "A definir"}</dd>
        </div>
        <div>
          <dt>Docente</dt>
          <dd>{plan.teacherName ?? "A definir"}</dd>
        </div>
        <div>
          <dt>Início</dt>
          <dd>{formatDateOnlyBR(dateOnly(plan.startDate))}</dd>
        </div>
      </dl>
      {plan.active && confirmed < riskLimit && (
        <p className={sheet.risk}>
          <TriangleAlert size={16} aria-hidden="true" />
          <span>
            <strong>Turma em risco</strong> · Menos de {riskLimit}{" "}
            {riskLimit === 1
              ? "aluno confirmado na turma ou pré-confirmado"
              : "alunos confirmados na turma ou pré-confirmados"}
            .
          </span>
        </p>
      )}
    </>
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
      className="max-w-full"
      aria-label={`Propor encaixe para ${student.studentName}`}
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
      <span className="truncate">Propor encaixe para {student.studentName.split(" ")[0]}</span>
    </Button>
  );
}
